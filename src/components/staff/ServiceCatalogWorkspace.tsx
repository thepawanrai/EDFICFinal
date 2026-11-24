import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Stethoscope,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Label } from '../ui/Card';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { apiFetch } from '../../lib/api';
import { formatInr, humanizeStatus } from '../../lib/utils';

interface ServiceItem {
  id: string;
  slug: string;
  code: string;
  name: string;
  categoryId: string;
  summary: string;
  clinicalDescription: string;
  preparationNotes: string;
  durationMinutes: number;
  requiresDoctorMorning: boolean;
  isVisiblePublic: boolean;
  advanceAmountInr: number;
  approvalStatus: string;
}

interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isVisible: boolean;
  services: ServiceItem[];
}

export function ServiceCatalogWorkspace() {
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Service modal (create or edit)
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    categoryId: '',
    summary: '',
    clinicalDescription: '',
    preparationNotes: '',
    durationMinutes: '30',
    advanceAmountInr: '500',
    requiresDoctorMorning: false,
    isVisiblePublic: true,
  });

  // Category modal (create or edit)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    sortOrder: '10',
    isVisible: true,
  });

  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cms-services'],
    queryFn: () => apiFetch<{ categories: ServiceCategory[] }>('/api/v1/cms/services'),
  });

  const categories = data?.categories ?? [];

  const allServices = useMemo(
    () =>
      categories.flatMap((cat) =>
        cat.services.map((s) => ({ ...s, categoryName: cat.name }))
      ),
    [categories]
  );

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allServices.filter((s) => {
      if (selectedCategoryId !== 'ALL' && s.categoryId !== selectedCategoryId) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.categoryName.toLowerCase().includes(q)
      );
    });
  }, [allServices, selectedCategoryId, searchQuery]);

  const publicVisibleCount = allServices.filter((s) => s.isVisiblePublic).length;
  const morningDoctorCount = allServices.filter((s) => s.requiresDoctorMorning).length;

  const invalidateCatalog = async () => {
    await queryClient.invalidateQueries({ queryKey: ['cms-services'] });
    await queryClient.invalidateQueries({ queryKey: ['public-services'] });
  };

  const openCreateService = () => {
    setEditingService(null);
    setServiceForm({
      name: '',
      categoryId: categories[0]?.id ?? '',
      summary: '',
      clinicalDescription: '',
      preparationNotes: 'Bring previous ultrasound reports, ANC card, and prescription.',
      durationMinutes: '30',
      advanceAmountInr: '500',
      requiresDoctorMorning: false,
      isVisiblePublic: true,
    });
    setServiceModalOpen(true);
  };

  const openEditService = (s: ServiceItem) => {
    setEditingService(s);
    setServiceForm({
      name: s.name,
      categoryId: s.categoryId,
      summary: s.summary,
      clinicalDescription: s.clinicalDescription,
      preparationNotes: s.preparationNotes,
      durationMinutes: String(s.durationMinutes),
      advanceAmountInr: String(s.advanceAmountInr),
      requiresDoctorMorning: s.requiresDoctorMorning,
      isVisiblePublic: s.isVisiblePublic,
    });
    setServiceModalOpen(true);
  };

  const handleSaveService = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const payload = {
        name: serviceForm.name.trim(),
        categoryId: serviceForm.categoryId,
        summary: serviceForm.summary.trim(),
        clinicalDescription: serviceForm.clinicalDescription.trim(),
        preparationNotes: serviceForm.preparationNotes.trim(),
        durationMinutes: Number(serviceForm.durationMinutes) || 30,
        advanceAmountInr: Number(serviceForm.advanceAmountInr) || 0,
        requiresDoctorMorning: serviceForm.requiresDoctorMorning,
        isVisiblePublic: serviceForm.isVisiblePublic,
      };
      if (editingService) {
        await apiFetch(`/api/v1/cms/services/${editingService.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedback(`Updated diagnostic scan "${payload.name}".`);
      } else {
        await apiFetch('/api/v1/cms/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback(`Created diagnostic scan "${payload.name}" in catalog.`);
      }
      setServiceModalOpen(false);
      await invalidateCatalog();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save diagnostic scan.');
    }
  };

  const handleToggleVisibility = async (s: ServiceItem) => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/cms/services/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isVisiblePublic: !s.isVisiblePublic }),
      });
      setFeedback(
        `${s.name} is now ${!s.isVisiblePublic ? 'visible on' : 'hidden from'} the public booking portal.`
      );
      await invalidateCatalog();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update visibility.');
    }
  };

  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm({
      name: '',
      description: '',
      sortOrder: String(categories.length + 1),
      isVisible: true,
    });
    setCategoryModalOpen(true);
  };

  const openEditCategory = (cat: ServiceCategory) => {
    setEditingCategory(cat);
    setCategoryForm({
      name: cat.name,
      description: cat.description,
      sortOrder: String(cat.sortOrder),
      isVisible: cat.isVisible,
    });
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async () => {
    setErrorMsg(null);
    setFeedback(null);
    try {
      const payload = {
        name: categoryForm.name.trim(),
        description: categoryForm.description.trim(),
        sortOrder: Number(categoryForm.sortOrder) || 10,
        isVisible: categoryForm.isVisible,
      };
      if (editingCategory) {
        await apiFetch(`/api/v1/cms/categories/${editingCategory.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedback(`Updated department category "${payload.name}".`);
      } else {
        await apiFetch('/api/v1/cms/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback(`Added department category "${payload.name}".`);
      }
      setCategoryModalOpen(false);
      await invalidateCatalog();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save category.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[#083642]">
            Diagnostic Scan &amp; Department Catalog
          </h2>
          <p className="text-xs text-[#65747B]">
            Configure fetal imaging departments, scan durations, advance deposits, morning specialist constraints, and public booking visibility. Automated NMC/PCPNDT copy compliance checks apply on save.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openCreateCategory}>
            <FolderPlus className="h-3.5 w-3.5" />
            <span>Add Category</span>
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={categories.length === 0}
            onClick={openCreateService}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Diagnostic Scan</span>
          </Button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Departments', val: categories.length, icon: Layers, color: 'text-[#0D4A5A]' },
          { label: 'Total Scans', val: allServices.length, icon: Stethoscope, color: 'text-[#287887]' },
          { label: 'Publicly Bookable', val: publicVisibleCount, icon: CheckCircle2, color: 'text-[#15803D]' },
          { label: 'Morning Specialist Only', val: morningDoctorCount, icon: Clock, color: 'text-[#0D4A5A]' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-[#DCE7E9] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#65747B]">{item.label}</span>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className="mt-1.5 font-mono-tabular text-2xl font-bold text-[#083642]">{item.val}</p>
            </div>
          );
        })}
      </div>

      {feedback && (
        <div className="rounded-md border border-[#287887] bg-[#E9F3F3] p-3 text-xs text-[#083642]">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-md border border-[#B42318]/40 bg-[#FEF3F2] p-3 text-xs text-[#B42318]">
          {errorMsg}
        </div>
      )}

      {/* Search + Department Tabs */}
      <div className="rounded-xl border border-[#DCE7E9] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#65747B]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scan name, code, or summary..."
              className="pl-9 text-xs"
            />
          </div>

          {selectedCategoryId !== 'ALL' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const cat = categories.find((c) => c.id === selectedCategoryId);
                if (cat) openEditCategory(cat);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Edit Selected Category</span>
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-[#E9F3F3] p-1 w-fit">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
              selectedCategoryId === 'ALL'
                ? 'bg-white text-[#0D4A5A] shadow-sm'
                : 'text-[#65747B] hover:text-[#083642]'
            }`}
          >
            All Departments ({allServices.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium cursor-pointer ${
                selectedCategoryId === cat.id
                  ? 'bg-white text-[#0D4A5A] shadow-sm'
                  : 'text-[#65747B] hover:text-[#083642]'
              }`}
            >
              {cat.name} ({cat.services.length})
            </button>
          ))}
        </div>
      </div>

      {/* Diagnostic Service Table */}
      <div className="rounded-xl border border-[#DCE7E9] bg-white overflow-x-auto">
        {isLoading ? (
          <div className="p-6 text-xs text-[#65747B]">Loading diagnostic scan catalog...</div>
        ) : filteredServices.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#65747B]">
            No diagnostic scans match your current filter.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#DCE7E9] bg-[#F8FAFA] text-[#65747B]">
              <tr>
                <th className="px-4 py-3 font-medium">Code &amp; Scan Name</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Advance Deposit</th>
                <th className="px-4 py-3 font-medium">Schedule Rule</th>
                <th className="px-4 py-3 font-medium">Public Portal</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9F3F3]">
              {filteredServices.map((s) => (
                <tr key={s.id} className="hover:bg-[#F8FBFC]">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="font-mono-tabular text-[11px] font-semibold text-[#287887]">
                      {s.code} · {humanizeStatus(s.approvalStatus)}
                    </p>
                    <p className="font-semibold text-[#083642]">{s.name}</p>
                    <p className="text-[11px] text-[#65747B] line-clamp-1">{s.summary}</p>
                  </td>
                  <td className="px-4 py-3 text-[#24343B]">{s.categoryName}</td>
                  <td className="px-4 py-3 font-mono-tabular text-[#083642]">
                    {s.durationMinutes} min
                  </td>
                  <td className="px-4 py-3 font-mono-tabular font-semibold text-[#083642]">
                    {formatInr(s.advanceAmountInr)}
                  </td>
                  <td className="px-4 py-3 text-[#65747B]">
                    {s.requiresDoctorMorning ? 'Morning Specialist' : 'All Clinic Hours'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-semibold ${
                        s.isVisiblePublic ? 'text-[#15803D]' : 'text-[#65747B]'
                      }`}
                    >
                      {s.isVisiblePublic ? 'Visible' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleVisibility(s)}
                      >
                        {s.isVisiblePublic ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        <span>{s.isVisiblePublic ? 'Hide' : 'Show'}</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEditService(s)}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Diagnostic Service Dialog */}
      <Dialog
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        title={editingService ? 'Edit Diagnostic Scan' : 'Add Diagnostic Scan'}
        description="Configure scan details, patient preparation instructions, duration, and UPI booking deposit."
        className="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Scan / Investigation Name *</Label>
              <Input
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
                placeholder="e.g., Fetal Neurosonography"
              />
            </div>
            <div>
              <Label>Department Category *</Label>
              <Select
                value={serviceForm.categoryId}
                onChange={(e) => setServiceForm({ ...serviceForm, categoryId: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Slot Duration (Minutes)</Label>
              <Input
                type="number"
                min={10}
                max={120}
                value={serviceForm.durationMinutes}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, durationMinutes: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Booking Advance Deposit (INR)</Label>
              <Input
                type="number"
                min={0}
                max={50000}
                value={serviceForm.advanceAmountInr}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, advanceAmountInr: e.target.value })
                }
              />
            </div>
          </div>

          <div>
            <Label>Short Summary (Public Card) *</Label>
            <Input
              value={serviceForm.summary}
              onChange={(e) => setServiceForm({ ...serviceForm, summary: e.target.value })}
              placeholder="Concise clinical purpose without pricing or promotional claims"
            />
          </div>

          <div>
            <Label>Clinical Description *</Label>
            <Textarea
              value={serviceForm.clinicalDescription}
              onChange={(e) =>
                setServiceForm({ ...serviceForm, clinicalDescription: e.target.value })
              }
              placeholder="Detailed overview of anatomical/Doppler evaluation and clinical indications"
            />
          </div>

          <div>
            <Label>Patient Preparation Instructions *</Label>
            <Textarea
              value={serviceForm.preparationNotes}
              onChange={(e) =>
                setServiceForm({ ...serviceForm, preparationNotes: e.target.value })
              }
            />
          </div>

          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
              <input
                type="checkbox"
                checked={serviceForm.requiresDoctorMorning}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, requiresDoctorMorning: e.target.checked })
                }
              />
              <span>Requires Morning Specialist Session</span>
            </label>
            <label className="flex items-center gap-2 text-[#24343B] cursor-pointer">
              <input
                type="checkbox"
                checked={serviceForm.isVisiblePublic}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, isVisiblePublic: e.target.checked })
                }
              />
              <span>Visible on Public Booking Portal</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setServiceModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                !serviceForm.name.trim() ||
                !serviceForm.categoryId ||
                serviceForm.summary.trim().length < 5 ||
                serviceForm.clinicalDescription.trim().length < 5
              }
              onClick={handleSaveService}
            >
              {editingService ? 'Save Changes' : 'Create Diagnostic Scan'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Add / Edit Category Dialog */}
      <Dialog
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title={editingCategory ? 'Edit Department Category' : 'Add Department Category'}
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Department Name *</Label>
            <Input
              value={categoryForm.name}
              onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
              placeholder="e.g., Specialized Fetal Neurology"
            />
          </div>
          <div>
            <Label>Description *</Label>
            <Textarea
              value={categoryForm.description}
              onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
              placeholder="Clinical scope of this diagnostic department"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <Label>Display Sort Order</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={categoryForm.sortOrder}
                onChange={(e) => setCategoryForm({ ...categoryForm, sortOrder: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-[#24343B] cursor-pointer pt-5">
              <input
                type="checkbox"
                checked={categoryForm.isVisible}
                onChange={(e) => setCategoryForm({ ...categoryForm, isVisible: e.target.checked })}
              />
              <span>Visible Publicly</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCategoryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!categoryForm.name.trim() || categoryForm.description.trim().length < 5}
              onClick={handleSaveCategory}
            >
              {editingCategory ? 'Save Category' : 'Create Category'}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
