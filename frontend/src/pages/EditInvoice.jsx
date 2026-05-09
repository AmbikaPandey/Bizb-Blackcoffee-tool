import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Save, Pencil } from 'lucide-react';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';
import { useAuth } from '../context/AuthContext';
import HsnAutocomplete from '../components/common/HsnAutocomplete';


const EMPTY_ITEM = {
    product_id: '',
    product_name: '',
    description: '',
    hsn: '',
    qty: 1,
    unit: 'NOS',
    rate: 0,
    discount_pct: 0,
    tax_pct: 18,
};

const UNITS = ['NOS', 'HRS', 'PCS', 'KGS', 'LTR', 'MTR', 'SQM', 'BOX', 'SET', 'Per Project', 'Per Month', 'Per Article', 'Per Video'];

function calcItemAmount(item) {
    const qty = parseFloat(item.qty) || 0;
    const rate = parseFloat(item.rate) || 0;
    const discPct = parseFloat(item.discount_pct) || 0;
    const taxPct = parseFloat(item.tax_pct) || 0;
    const lineTotal = qty * rate;
    const afterDiscount = lineTotal - lineTotal * (discPct / 100);
    const tax = afterDiscount * (taxPct / 100);
    return Math.round((afterDiscount + tax) * 100) / 100;
}

export default function EditInvoice() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const { isAdmin } = useAuth();

    const [clients, setClients] = useState([]);
    const [products, setProducts] = useState([]);
    const [states, setStates] = useState([]);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [invoiceNumEditable, setInvoiceNumEditable] = useState(false);

    const [form, setForm] = useState({
        client_id: '',
        invoice_type: 'Tax Invoice',
        invoice_number: '',
        tax_type: 'IGST',
        invoice_date: '',
        credit_period: '',
        place_of_supply: '',
        po_number: '',
        transport: '',
        vehicle_no: '',
        gr_rr_no: '',
        eway_bill: '',
        notes: '',
        terms: '',
    });

    const [items, setItems] = useState([{ ...EMPTY_ITEM }]);

    useEffect(() => {
        Promise.all([
            api.getClients(),
            api.getProducts(),
            api.getStates(),
            api.getInvoice(id),
        ]).then(([c, p, s, inv]) => {
            setClients(c);
            setProducts(p);
            setStates(s);
            setForm({
                client_id: inv.client_id || '',
                invoice_type: inv.invoice_type || 'Tax Invoice',
                invoice_number: inv.invoice_number || '',
                tax_type: inv.tax_type || 'IGST',
                invoice_date: inv.invoice_date || '',
                credit_period: inv.credit_period != null ? String(inv.credit_period) : '',
                place_of_supply: inv.place_of_supply || '',
                po_number: inv.po_number || '',
                transport: inv.transport || '',
                vehicle_no: inv.vehicle_no || '',
                gr_rr_no: inv.gr_rr_no || '',
                eway_bill: inv.eway_bill || '',
                notes: inv.notes || '',
                terms: inv.terms || '',
            });
            setItems(inv.items && inv.items.length > 0 ? inv.items.map((item) => ({
                product_id: item.product_id || '',
                product_name: item.product_name || '',
                description: item.description || '',
                hsn: item.hsn || '',
                qty: item.qty || 1,
                unit: item.unit || 'NOS',
                rate: item.rate || 0,
                discount_pct: item.discount_pct || 0,
                tax_pct: item.tax_pct || 18,
            })) : [{ ...EMPTY_ITEM }]);
        }).catch(() => {
            setError('Failed to load invoice data.');
        }).finally(() => setLoading(false));
    }, [id]);

    const updateForm = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
    };

    const updateItem = useCallback((index, field, value) => {
        setItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }, []);

    const handleProductSelect = useCallback((index, productId) => {
        if (!productId || productId === 'custom') {
            updateItem(index, 'product_id', '');
            return;
        }
        const product = products.find((p) => String(p.id) === String(productId));
        if (product) {
            setItems((prev) => {
                const updated = [...prev];
                updated[index] = {
                    ...updated[index],
                    product_id: product.id,
                    product_name: product.name,
                    description: product.description || '',
                    hsn: product.hsn || '',
                    rate: product.rate || 0,
                    unit: product.unit || 'NOS',
                    tax_pct: product.gst || 18,
                };
                return updated;
            });
        }
    }, [products, updateItem]);

    const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);

    const removeItem = (index) => {
        if (items.length <= 1) return;
        setItems((prev) => prev.filter((_, i) => i !== index));
    };

    const subtotal = items.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discPct = parseFloat(item.discount_pct) || 0;
        const lineTotal = qty * rate;
        return sum + (lineTotal - lineTotal * (discPct / 100));
    }, 0);

    const taxableAmount = items.reduce((sum, item) => {
        const qty = parseFloat(item.qty) || 0;
        const rate = parseFloat(item.rate) || 0;
        const discPct = parseFloat(item.discount_pct) || 0;
        const taxPct = parseFloat(item.tax_pct) || 0;
        const lineTotal = qty * rate;
        const afterDiscount = lineTotal - lineTotal * (discPct / 100);
        return sum + afterDiscount * (taxPct / 100);
    }, 0);

    const grandTotal = subtotal + taxableAmount;

    const handleSubmit = async () => {
        if (!form.client_id) {
            setError('Please select a client');
            return;
        }
        if (!form.invoice_date) {
            setError('Please select an invoice date');
            return;
        }

        setError('');
        setSaving(true);

        try {
            await api.updateInvoice(id, {
                ...form,
                type: form.invoice_type === 'Proforma' ? 'proforma' : 'tax',
                items: items.map((item) => ({
                    ...item,
                    amount: calcItemAmount(item),
                })),
            });
            toast('Invoice updated successfully');
            navigate(`/invoices/${id}`);
        } catch (err) {
            setError(err.message || 'Failed to update invoice');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="page-loading">Loading invoice...</div>;

    return (
        <div className="new-invoice">
            <div className="new-invoice__header">
                <button className="new-invoice__back" onClick={() => navigate(`/invoices/${id}`)}>
                    <ArrowLeft size={18} /> Back
                </button>
                <h1>Edit Invoice — {form.invoice_number}</h1>
            </div>

            {error && <div className="new-invoice__error">{error}</div>}

            <div className="new-invoice__top">
                <div className="new-invoice__card new-invoice__card--details">
                    <h2>Invoice Details</h2>
                    <div className="new-invoice__grid">
                        <div className="new-invoice__field">
                            <label>Client *</label>
                            <select value={form.client_id} onChange={(e) => updateForm('client_id', e.target.value)}>
                                <option value="">Select client</option>
                                {clients.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="new-invoice__field">
                            <label>Invoice Type</label>
                            <select value={form.invoice_type} onChange={(e) => updateForm('invoice_type', e.target.value)}>
                                <option>Tax Invoice</option>
                                <option>Proforma</option>
                            </select>
                        </div>
                    </div>
                    <div className="new-invoice__grid">
                        <div className="new-invoice__field">
                            <label>Invoice Number</label>
                            <div className="new-invoice__field-with-btn">
                                <input type="text" value={form.invoice_number} disabled={!invoiceNumEditable} onChange={(e) => updateForm('invoice_number', e.target.value)} />
                                {isAdmin && !invoiceNumEditable && (
                                    <button type="button" className="new-invoice__edit-btn" onClick={() => setInvoiceNumEditable(true)} title="Edit invoice number">
                                        <Pencil size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="new-invoice__field">
                            <label>Tax Type</label>
                            <select value={form.tax_type} onChange={(e) => updateForm('tax_type', e.target.value)}>
                                <option>IGST</option>
                                <option>CGST + SGST</option>
                            </select>
                        </div>
                    </div>
                    <div className="new-invoice__grid">
                        <div className="new-invoice__field">
                            <label>Invoice Date</label>
                            <input type="date" value={form.invoice_date} onChange={(e) => updateForm('invoice_date', e.target.value)} />
                        </div>
                        <div className="new-invoice__field">
                            <label>Credit Period (Days)</label>
                            <input type="number" min="0" value={form.credit_period} placeholder="e.g. 30" onChange={(e) => updateForm('credit_period', e.target.value)} />
                        </div>
                    </div>
                    <div className="new-invoice__grid">
                        <div className="new-invoice__field">
                            <label>Place of Supply</label>
                            <select value={form.place_of_supply} onChange={(e) => updateForm('place_of_supply', e.target.value)}>
                                <option value="">Select state</option>
                                {states.map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="new-invoice__field">
                            <label>PO Number</label>
                            <input type="text" placeholder="Purchase order number" value={form.po_number} onChange={(e) => updateForm('po_number', e.target.value)} />
                        </div>
                    </div>
                </div>

                <div className="new-invoice__card new-invoice__card--transport">
                    <h2>Transport Details</h2>
                    <div className="new-invoice__field">
                        <label>Transport</label>
                        <input type="text" placeholder="Transport company" value={form.transport} onChange={(e) => updateForm('transport', e.target.value)} />
                    </div>
                    <div className="new-invoice__field">
                        <label>Vehicle No.</label>
                        <input type="text" placeholder="Vehicle number" value={form.vehicle_no} onChange={(e) => updateForm('vehicle_no', e.target.value)} />
                    </div>
                    <div className="new-invoice__field">
                        <label>GR/RR No.</label>
                        <input type="text" placeholder="GR/RR number" value={form.gr_rr_no} onChange={(e) => updateForm('gr_rr_no', e.target.value)} />
                    </div>
                    <div className="new-invoice__field">
                        <label>E-Way Bill</label>
                        <input type="text" placeholder="E-way bill number" value={form.eway_bill} onChange={(e) => updateForm('eway_bill', e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="new-invoice__card new-invoice__card--items">
                <div className="new-invoice__card-header">
                    <h2>Invoice Items</h2>
                    <button className="new-invoice__add-btn" onClick={addItem}>
                        <Plus size={16} /> Add Item
                    </button>
                </div>

                <div className="new-invoice__items-table">
                    <div className="new-invoice__items-head">
                        <span className="col-num">#</span>
                        <span className="col-product">Product / Description</span>
                        <span className="col-hsn">HSN/SAC</span>
                        <span className="col-qty">Qty</span>
                        <span className="col-unit">Unit</span>
                        <span className="col-rate">Rate</span>
                        <span className="col-disc">Disc %</span>
                        <span className="col-tax">Tax %</span>
                        <span className="col-amount">Amount</span>
                        <span className="col-action"></span>
                    </div>

                    {items.map((item, idx) => (
                        <div className="new-invoice__item-row" key={idx}>
                            <div className="new-invoice__item-main">
                                <span className="col-num">{idx + 1}</span>
                                <div className="col-product">
                                    <select value={item.product_id || 'custom'} onChange={(e) => handleProductSelect(idx, e.target.value)}>
                                        <option value="custom">Custom item</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}{p.description ? ` — ${p.description}` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-hsn">
                                    <HsnAutocomplete
                                        value={item.hsn}
                                        onChange={(val) => updateItem(idx, 'hsn', val)}
                                        onSelect={(hsn) => {
                                            const updated = [...items];
                                            updated[idx] = {
                                                ...updated[idx],
                                                hsn: hsn.hsnCode,
                                                product_name: hsn.productName || updated[idx].product_name,
                                                description: hsn.description || updated[idx].description,
                                                tax_pct: hsn.gstRate ?? updated[idx].tax_pct,
                                            };
                                            setItems(updated);
                                        }}
                                    />
                                </div>
                                <div className="col-qty">
                                    <input type="number" min="0" step="1" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} />
                                </div>
                                <div className="col-unit">
                                    <select value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)}>
                                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div className="col-rate">
                                    <input type="number" min="0" step="0.01" value={item.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} />
                                </div>
                                <div className="col-disc">
                                    <input type="number" min="0" max="100" step="0.01" value={item.discount_pct} onChange={(e) => updateItem(idx, 'discount_pct', e.target.value)} />
                                </div>
                                <div className="col-tax">
                                    <input type="number" min="0" max="100" step="0.01" value={item.tax_pct} onChange={(e) => updateItem(idx, 'tax_pct', e.target.value)} />
                                </div>
                                <span className="col-amount">{formatCurrency(calcItemAmount(item))}</span>
                                <div className="col-action">
                                    <button className="new-invoice__delete-btn" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="new-invoice__item-extra">
                                <input
                                    type="text"
                                    className="new-invoice__item-name"
                                    placeholder="Product Name"
                                    value={item.product_name}
                                    onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                                />
                                <input
                                    type="text"
                                    className="new-invoice__item-desc"
                                    placeholder="Optional description"
                                    value={item.description}
                                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="new-invoice__bottom">
                <div className="new-invoice__card new-invoice__card--notes">
                    <h2>Notes & Terms</h2>
                    <div className="new-invoice__field">
                        <label>Notes</label>
                        <textarea rows="4" placeholder="Additional notes for the client" value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} />
                    </div>
                    <div className="new-invoice__field">
                        <label>Payment Terms</label>
                        <textarea rows="4" value={form.terms} onChange={(e) => updateForm('terms', e.target.value)} />
                    </div>
                </div>

                <div className="new-invoice__card new-invoice__card--summary">
                    <h2>Invoice Summary</h2>
                    <div className="new-invoice__summary-row">
                        <span className="new-invoice__summary-label">Subtotal</span>
                        <span className="new-invoice__summary-value">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="new-invoice__summary-row">
                        <span className="new-invoice__summary-label">Taxable Amount</span>
                        <span className="new-invoice__summary-value">{formatCurrency(taxableAmount)}</span>
                    </div>
                    <div className="new-invoice__summary-row new-invoice__summary-row--total">
                        <span className="new-invoice__summary-label">Grand Total</span>
                        <span className="new-invoice__summary-value">{formatCurrency(grandTotal)}</span>
                    </div>
                </div>
            </div>

            <div className="new-invoice__footer">
                <button className="new-invoice__cancel-btn" onClick={() => navigate(`/invoices/${id}`)}>
                    Cancel
                </button>
                <button className="new-invoice__submit-btn" onClick={handleSubmit} disabled={saving}>
                    <Save size={18} />
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
}
