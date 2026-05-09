import { useState, useEffect, useRef, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import StatusBadge from '../components/common/StatusBadge';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import HsnAutocomplete from '../components/common/HsnAutocomplete';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { uppercaseFormData } from '../utils/formTransform';

const HSN_RE = /^\d{4}(\d{2}(\d{2})?)?$/;
const emptyForm = { name: '', vendor_id: '', category: '', hsn: '', rate: '', unit: 'NOS', gst: '18', description: '', status: 'Active' };

export default function Products() {
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);
    const [hsnError, setHsnError] = useState('');
    const [nameSuggestions, setNameSuggestions] = useState([]);
    const [showNameSuggestions, setShowNameSuggestions] = useState(false);
    const nameDebounce = useRef(null);
    const nameWrapRef = useRef(null);

    // Close product name suggestions on outside click
    useEffect(() => {
        const handler = (e) => {
            if (nameWrapRef.current && !nameWrapRef.current.contains(e.target)) {
                setShowNameSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const searchProductName = useCallback((term) => {
        if (nameDebounce.current) clearTimeout(nameDebounce.current);
        if (!term || term.length < 2) {
            setNameSuggestions([]);
            setShowNameSuggestions(false);
            return;
        }
        nameDebounce.current = setTimeout(async () => {
            try {
                const data = await api.searchHsnMaster(term, 10);
                const hits = (data.results || []).map(r => ({
                    hsnCode: r.code || r.hsnCode,
                    productName: r.productName || r.keywords?.join(', ') || '',
                    gstRate: r.gstRate,
                    category: r.category || '',
                    description: r.description || '',
                    type: r.type || 'HSN',
                    keywords: r.keywords || [],
                }));
                setNameSuggestions(hits);
                setShowNameSuggestions(hits.length > 0);
            } catch {
                setNameSuggestions([]);
                setShowNameSuggestions(false);
            }
        }, 300);
    }, []);

    async function loadProducts() {
        try {
            const [prods, vends] = await Promise.all([api.getProducts(), api.getVendors()]);
            setProducts(prods);
            setVendors(vends);
        }
        catch { toast('Failed to load products', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadProducts(); }, []);

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setHsnError('');
        setShowModal(true);
    }

    function openEdit(p) {
        setEditTarget(p);
        setForm({
            name: p.name || '', vendor_id: p.vendor_id?._id || p.vendor_id || '',
            category: p.category || '', hsn: p.hsn || '', rate: p.rate || '',
            unit: p.unit || 'NOS', gst: p.gst ?? '18', description: p.description || '',
            status: p.status || 'Active',
        });
        setHsnError('');
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { toast('Product name is required', 'error'); return; }
        if (!form.hsn || !HSN_RE.test(form.hsn)) { setHsnError('Valid HSN is required (4, 6, or 8 digits)'); toast('Valid HSN code is required', 'error'); return; }
        setSaving(true);
        try {
            const data = uppercaseFormData({ ...form, vendor_id: form.vendor_id || null, rate: parseFloat(form.rate) || 0, gst: parseFloat(form.gst) || 0 });
            if (editTarget) {
                await api.updateProduct(editTarget.id || editTarget._id, data);
                toast('Product updated');
            } else {
                await api.createProduct(data);
                toast('Product created');
            }
            setShowModal(false);
            loadProducts();
        } catch (err) { toast(err.message || 'Failed to save product', 'error'); }
        finally { setSaving(false); }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            await api.deleteProduct(deleteTarget.id || deleteTarget._id);
            toast('Product deleted');
            setDeleteTarget(null);
            loadProducts();
        } catch (err) { toast(err.message || 'Failed to delete product', 'error'); }
    }

    const activeVendors = vendors.filter(v => v.name && (v.status || 'Active') === 'Active');

    const filtered = products.filter((p) =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.hsn || '').includes(search) ||
        (p.vendor_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.category || '').toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Products & Services" subtitle="Manage your products and service catalog" buttonLabel="Add Product" onButtonClick={openCreate} />

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search products by name, HSN, vendor..." value={search} onChange={setSearch} />
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>Vendor</th>
                                <th>Category</th>
                                <th>HSN/SAC</th>
                                <th className="text-right">Rate</th>
                                <th>Unit</th>
                                <th className="text-right">GST %</th>
                                <th>Status</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <tr key={p.id || p._id}>
                                    <td className="font-medium">{p.name}</td>
                                    <td>{p.vendor_name || '-'}</td>
                                    <td>{p.category || '-'}</td>
                                    <td className="mono">{p.hsn}</td>
                                    <td className="text-right">{formatCurrency(p.rate)}</td>
                                    <td>{p.unit}</td>
                                    <td className="text-right">{p.gst}%</td>
                                    <td><StatusBadge status={p.status || 'Active'} /></td>
                                    <td>
                                        <ActionMenu actions={[
                                            { icon: <Pencil size={15} />, label: 'Edit', onClick: () => openEdit(p) },
                                            { divider: true },
                                            { icon: <Trash2 size={15} />, label: 'Delete', danger: true, onClick: () => setDeleteTarget(p) },
                                        ]} />
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && (
                                <tr><td colSpan={9} className="text-center">No products found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Product' : 'Add Product'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-group__label">Product Name *</label>
                        <div className="hsn-autocomplete" ref={nameWrapRef}>
                            <input type="text" placeholder="Enter product name" className="form-group__input"
                                value={form.name}
                                onChange={(e) => {
                                    setForm({ ...form, name: e.target.value });
                                    searchProductName(e.target.value);
                                }}
                                onFocus={() => { if (nameSuggestions.length > 0) setShowNameSuggestions(true); }}
                                autoComplete="off"
                                required />
                            {showNameSuggestions && nameSuggestions.length > 0 && (
                                <ul className="hsn-autocomplete__dropdown">
                                    {nameSuggestions.map((item, idx) => (
                                        <li key={item.hsnCode + idx}
                                            className="hsn-autocomplete__item"
                                            onMouseDown={() => {
                                                setForm((prev) => ({
                                                    ...prev,
                                                    name: item.keywords?.join(', ') || item.productName || prev.name,
                                                    hsn: item.hsnCode,
                                                    gst: String(item.gstRate ?? prev.gst),
                                                    category: prev.category || item.category,
                                                    description: prev.description || item.description,
                                                }));
                                                setHsnError('');
                                                setShowNameSuggestions(false);
                                            }}>
                                            <span className="hsn-autocomplete__code">{item.hsnCode}</span>
                                            <span className="hsn-autocomplete__name">{item.keywords?.join(', ') || item.productName}</span>
                                            <span className="hsn-autocomplete__gst">{item.gstRate}%</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">Vendor</label>
                            <select className="form-group__input" value={form.vendor_id} onChange={(e) => setForm({ ...form, vendor_id: e.target.value })}>
                                <option value="">No Vendor</option>
                                {activeVendors.map(v => (
                                    <option key={v.id || v._id} value={v.id || v._id}>{v.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Category</label>
                            <input type="text" placeholder="e.g. Software, Hardware" className="form-group__input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">HSN/SAC Code *</label>
                            <HsnAutocomplete
                                value={form.hsn}
                                onChange={(val) => {
                                    setForm({ ...form, hsn: val });
                                    if (val && !HSN_RE.test(val)) setHsnError('HSN must be 4, 6, or 8 digits');
                                    else setHsnError('');
                                }}
                                onSelect={(hsn) => {
                                    setForm((prev) => ({
                                        ...prev,
                                        hsn: hsn.hsnCode,
                                        name: prev.name || hsn.productName,
                                        description: prev.description || hsn.description,
                                        gst: String(hsn.gstRate ?? prev.gst),
                                        category: prev.category || hsn.category,
                                    }));
                                    setHsnError('');
                                }}
                                placeholder="e.g. 998361"
                                error={hsnError}
                            />
                            {hsnError && <span className="form-group__error">{hsnError}</span>}
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Rate</label>
                            <input type="number" step="0.01" min="0" placeholder="0.00" className="form-group__input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--3">
                        <div className="form-group">
                            <label className="form-group__label">Unit</label>
                            <select className="form-group__input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                                <option>NOS</option><option>HRS</option><option>KGS</option><option>MTR</option><option>LTR</option><option>PCS</option><option>SET</option><option>BOX</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">GST %</label>
                            <select className="form-group__input" value={form.gst} onChange={(e) => setForm({ ...form, gst: e.target.value })}>
                                <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Status</label>
                            <select className="form-group__input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-group__label">Description</label>
                        <textarea rows={2} placeholder="Product description" className="form-group__textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                        <button type="submit" className="btn-save" disabled={saving}>{saving ? 'Saving...' : editTarget ? 'Update Product' : 'Save Product'}</button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog isOpen={!!deleteTarget} title="Delete Product" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
        </div>
    );
}
