import { useState, useEffect } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import SearchBar from '../components/common/SearchBar';
import Modal from '../components/common/Modal';
import ConfirmDialog from '../components/common/ConfirmDialog';
import PageLoader from '../components/common/PageLoader';
import ActionMenu from '../components/common/ActionMenu';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { uppercaseFormData } from '../utils/formTransform';

const emptyForm = { name: '', hsn: '', rate: '', unit: 'NOS', gst: '18', description: '' };

export default function Products() {
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [saving, setSaving] = useState(false);

    async function loadProducts() {
        try { setProducts(await api.getProducts()); }
        catch { toast('Failed to load products', 'error'); }
        finally { setLoading(false); }
    }

    useEffect(() => { loadProducts(); }, []);

    function openCreate() {
        setEditTarget(null);
        setForm({ ...emptyForm });
        setShowModal(true);
    }

    function openEdit(p) {
        setEditTarget(p);
        setForm({ name: p.name || '', hsn: p.hsn || '', rate: p.rate || '', unit: p.unit || 'NOS', gst: p.gst ?? '18', description: p.description || '' });
        setShowModal(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!form.name.trim()) { toast('Product name is required', 'error'); return; }
        setSaving(true);
        try {
            const data = uppercaseFormData({ ...form, rate: parseFloat(form.rate) || 0, gst: parseFloat(form.gst) || 0 });
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

    const filtered = products.filter((p) =>
        (p.name || '').toLowerCase().includes(search.toLowerCase()) || (p.hsn || '').includes(search)
    );

    if (loading) return <PageLoader />;

    return (
        <div>
            <PageHeader title="Products & Services" subtitle="Manage your products and service catalog" buttonLabel="Add Product" onButtonClick={openCreate} />

            <div className="page-card">
                <div className="page-card__toolbar">
                    <SearchBar placeholder="Search products by name or HSN..." value={search} onChange={setSearch} />
                </div>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>HSN/SAC</th>
                                <th className="text-right">Rate</th>
                                <th>Unit</th>
                                <th className="text-right">GST %</th>
                                <th>Description</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((p) => (
                                <tr key={p.id || p._id}>
                                    <td className="font-medium">{p.name}</td>
                                    <td className="mono">{p.hsn}</td>
                                    <td className="text-right">{formatCurrency(p.rate)}</td>
                                    <td>{p.unit}</td>
                                    <td className="text-right">{p.gst}%</td>
                                    <td>{p.description}</td>
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
                                <tr><td colSpan={7} className="text-center">No products found</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTarget ? 'Edit Product' : 'Add Product'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-group__label">Product Name *</label>
                        <input type="text" placeholder="Enter product name" className="form-group__input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="form-row form-row--2">
                        <div className="form-group">
                            <label className="form-group__label">HSN/SAC Code</label>
                            <input type="text" placeholder="e.g. 998361" className="form-group__input" value={form.hsn} onChange={(e) => setForm({ ...form, hsn: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-group__label">Rate</label>
                            <input type="number" step="0.01" min="0" placeholder="0.00" className="form-group__input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                        </div>
                    </div>
                    <div className="form-row form-row--2">
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
