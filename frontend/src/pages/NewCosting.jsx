import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/common/Toast';
import { formatCurrency } from '../utils/currency';

const emptyItem = {
    description: '', hsn: '', qty: 1, unit: 'NOS',
    vendor_cost: 0, markup_pct: 15, gst_pct: 18,
};

export default function NewCosting() {
    const { id } = useParams();
    const isEdit = !!id;
    const navigate = useNavigate();
    const { user } = useAuth();
    const { showToast } = useToast();

    const canSeeVendorCosts = ['Super Admin', 'Admin'].includes(user?.role);

    const [form, setForm] = useState({
        title: '', description: '', client_id: '', project_id: '',
        agency_service_charge_pct: 15, notes: '',
    });
    const [items, setItems] = useState([{ ...emptyItem }]);
    const [clients, setClients] = useState([]);
    const [projects, setProjects] = useState([]);
    const [products, setProducts] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const init = async () => {
            try {
                const [c, p] = await Promise.all([api.getClients(), api.getProducts().catch(() => [])]);
                setClients(c);
                setProducts(p);
                if (isEdit) {
                    const costing = await api.getCosting(id);
                    setForm({
                        title: costing.title || '',
                        description: costing.description || '',
                        client_id: costing.client_id?._id || costing.client_id || '',
                        project_id: costing.project_id?._id || costing.project_id || '',
                        agency_service_charge_pct: costing.agency_service_charge_pct ?? 15,
                        notes: costing.notes || '',
                    });
                    setItems(costing.items?.length > 0 ? costing.items : [{ ...emptyItem }]);
                }
            } catch (err) {
                showToast(err.message, 'error');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [id]);

    useEffect(() => {
        if (form.client_id) {
            api.getProjects().then(p => setProjects(p.filter(pr => String(pr.client_id) === String(form.client_id)))).catch(() => { });
        }
    }, [form.client_id]);

    const updateItem = (idx, field, value) => {
        setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };

    const addItem = () => setItems(prev => [...prev, { ...emptyItem }]);
    const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

    const selectProduct = (idx, productId) => {
        const product = products.find(p => String(p.id || p._id) === productId);
        if (product) {
            setItems(prev => prev.map((item, i) => i === idx ? {
                ...item,
                product_id: product.id || product._id,
                description: product.name,
                hsn: product.hsn || '',
                vendor_cost: product.rate || 0,
                gst_pct: product.gst || 18,
                unit: product.unit || 'NOS',
            } : item));
        }
    };

    // Calculations
    const calcItem = (item) => {
        const qty = parseFloat(item.qty) || 0;
        const vendorCost = parseFloat(item.vendor_cost) || 0;
        const markupPct = parseFloat(item.markup_pct) || 0;
        const sellingRate = vendorCost * (1 + markupPct / 100);
        const vendorAmount = vendorCost * qty;
        const sellingAmount = sellingRate * qty;
        const profit = sellingAmount - vendorAmount;
        return { sellingRate, vendorAmount, sellingAmount, profit };
    };

    const subtotalVendor = items.reduce((s, item) => s + calcItem(item).vendorAmount, 0);
    const subtotalSelling = items.reduce((s, item) => s + calcItem(item).sellingAmount, 0);
    const totalMarkup = subtotalSelling - subtotalVendor;
    const agencyPct = parseFloat(form.agency_service_charge_pct) || 0;
    const agencyCharge = subtotalSelling * (agencyPct / 100);
    const taxAmount = items.reduce((s, item) => {
        const { sellingAmount } = calcItem(item);
        return s + sellingAmount * ((parseFloat(item.gst_pct) || 0) / 100);
    }, 0);
    const grandTotal = subtotalSelling + agencyCharge + taxAmount;
    const totalProfit = totalMarkup + agencyCharge;
    const profitMarginPct = grandTotal > 0 ? (totalProfit / grandTotal) * 100 : 0;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return showToast('Title is required', 'error');
        if (!form.client_id) return showToast('Client is required', 'error');
        if (items.length === 0) return showToast('Add at least one item', 'error');

        setSaving(true);
        try {
            const payload = { ...form, items };
            if (isEdit) {
                await api.updateCosting(id, payload);
                showToast('Costing updated');
            } else {
                await api.createCosting(payload);
                showToast('Costing created');
            }
            navigate('/costings');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loader">Loading...</div>;

    return (
        <div className="page new-costing-page">
            <div className="page__header">
                <button className="btn btn--ghost" onClick={() => navigate('/costings')}>
                    <ArrowLeft size={16} /> Back
                </button>
                <h1>{isEdit ? 'Edit Costing' : 'New Internal Costing'}</h1>
            </div>

            <form onSubmit={handleSubmit} className="costing-form">
                <div className="form-grid">
                    <div className="form-group">
                        <label>Title *</label>
                        <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                    </div>
                    <div className="form-group">
                        <label>Client *</label>
                        <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} required>
                            <option value="">Select Client</option>
                            {clients.map(c => <option key={c.id || c._id} value={c.id || c._id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Project</label>
                        <select value={form.project_id} onChange={e => setForm({ ...form, project_id: e.target.value })}>
                            <option value="">Select Project</option>
                            {projects.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Agency Service Charge %</label>
                        <input type="number" min="0" step="0.5" value={form.agency_service_charge_pct}
                            onChange={e => setForm({ ...form, agency_service_charge_pct: e.target.value })} />
                    </div>
                    <div className="form-group form-group--full">
                        <label>Description</label>
                        <textarea rows="2" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                </div>

                {/* Items Table */}
                <div className="costing-items">
                    <div className="costing-items__header">
                        <h3>Line Items</h3>
                        <button type="button" className="btn btn--sm" onClick={addItem}><Plus size={14} /> Add Item</button>
                    </div>

                    <div className="costing-items__table-wrap">
                        <table className="costing-items__table">
                            <thead>
                                <tr>
                                    <th style={{ width: '180px' }}>Product / Description</th>
                                    <th style={{ width: '80px' }}>HSN</th>
                                    <th style={{ width: '60px' }}>Qty</th>
                                    <th style={{ width: '60px' }}>Unit</th>
                                    {canSeeVendorCosts && <th style={{ width: '100px' }}>Vendor Cost</th>}
                                    <th style={{ width: '80px' }}>Markup %</th>
                                    <th style={{ width: '100px' }}>Selling Rate</th>
                                    <th style={{ width: '60px' }}>GST %</th>
                                    <th style={{ width: '100px' }}>Amount</th>
                                    {canSeeVendorCosts && <th style={{ width: '100px' }}>Profit</th>}
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item, idx) => {
                                    const calc = calcItem(item);
                                    return (
                                        <tr key={idx}>
                                            <td>
                                                <select value={item.product_id || ''} onChange={e => selectProduct(idx, e.target.value)} className="input-sm">
                                                    <option value="">Custom</option>
                                                    {products.map(p => <option key={p.id || p._id} value={p.id || p._id}>{p.name}</option>)}
                                                </select>
                                                <input type="text" className="input-sm mt-1" placeholder="Description" value={item.description}
                                                    onChange={e => updateItem(idx, 'description', e.target.value)} />
                                            </td>
                                            <td><input type="text" className="input-sm" value={item.hsn} onChange={e => updateItem(idx, 'hsn', e.target.value)} /></td>
                                            <td><input type="number" className="input-sm" min="0" value={item.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} /></td>
                                            <td><input type="text" className="input-sm" value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} /></td>
                                            {canSeeVendorCosts && (
                                                <td><input type="number" className="input-sm" min="0" step="0.01" value={item.vendor_cost}
                                                    onChange={e => updateItem(idx, 'vendor_cost', e.target.value)} /></td>
                                            )}
                                            <td><input type="number" className="input-sm" min="0" step="0.5" value={item.markup_pct}
                                                onChange={e => updateItem(idx, 'markup_pct', e.target.value)} /></td>
                                            <td className="text-right font-mono">{formatCurrency(calc.sellingRate)}</td>
                                            <td><input type="number" className="input-sm" min="0" value={item.gst_pct}
                                                onChange={e => updateItem(idx, 'gst_pct', e.target.value)} /></td>
                                            <td className="text-right font-mono">{formatCurrency(calc.sellingAmount)}</td>
                                            {canSeeVendorCosts && <td className="text-right font-mono text-success">{formatCurrency(calc.profit)}</td>}
                                            <td>
                                                {items.length > 1 && (
                                                    <button type="button" className="btn-icon btn-icon--danger" onClick={() => removeItem(idx)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary */}
                <div className="costing-summary">
                    {canSeeVendorCosts && (
                        <div className="costing-summary__row">
                            <span>Total Vendor Cost</span>
                            <span className="font-mono">{formatCurrency(subtotalVendor)}</span>
                        </div>
                    )}
                    <div className="costing-summary__row">
                        <span>Subtotal (Selling)</span>
                        <span className="font-mono">{formatCurrency(subtotalSelling)}</span>
                    </div>
                    {canSeeVendorCosts && (
                        <div className="costing-summary__row text-success">
                            <span>Total Markup</span>
                            <span className="font-mono">{formatCurrency(totalMarkup)}</span>
                        </div>
                    )}
                    <div className="costing-summary__row">
                        <span>Agency Service Charge ({agencyPct}%)</span>
                        <span className="font-mono">{formatCurrency(agencyCharge)}</span>
                    </div>
                    <div className="costing-summary__row">
                        <span>Tax</span>
                        <span className="font-mono">{formatCurrency(taxAmount)}</span>
                    </div>
                    <div className="costing-summary__row costing-summary__row--total">
                        <span>Grand Total</span>
                        <span className="font-mono">{formatCurrency(grandTotal)}</span>
                    </div>
                    {canSeeVendorCosts && (
                        <>
                            <div className="costing-summary__row text-success">
                                <span>Total Profit</span>
                                <span className="font-mono">{formatCurrency(totalProfit)}</span>
                            </div>
                            <div className="costing-summary__row text-success">
                                <span>Profit Margin</span>
                                <span className="font-mono">{profitMarginPct.toFixed(1)}%</span>
                            </div>
                        </>
                    )}
                </div>

                <div className="form-group form-group--full">
                    <label>Notes</label>
                    <textarea rows="2" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>

                <div className="form-actions">
                    <button type="button" className="btn btn--ghost" onClick={() => navigate('/costings')}>Cancel</button>
                    <button type="submit" className="btn btn--primary" disabled={saving}>
                        <Save size={16} /> {saving ? 'Saving...' : (isEdit ? 'Update' : 'Create')} Costing
                    </button>
                </div>
            </form>
        </div>
    );
}
