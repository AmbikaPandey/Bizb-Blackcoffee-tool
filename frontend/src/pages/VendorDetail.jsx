import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Phone, Mail, CreditCard, Package } from 'lucide-react';
import PageLoader from '../components/common/PageLoader';
import { useToast } from '../components/common/Toast';
import { api } from '../services/api';
import { formatCurrency } from '../utils/currency';

const formatDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

function maskAccount(num) {
    if (!num || num.length < 4) return num || '-';
    return '●'.repeat(num.length - 4) + num.slice(-4);
}

export default function VendorDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();
    const [vendor, setVendor] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getVendor(id)
            .then(setVendor)
            .catch(() => { toast('Failed to load vendor', 'error'); navigate('/vendors'); })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) return <PageLoader />;
    if (!vendor) return null;

    const bank = vendor.bank_details || {};
    const products = vendor.products || [];

    return (
        <div className="vendor-detail">
            <button className="vendor-detail__back" onClick={() => navigate('/vendors')}>
                <ArrowLeft size={18} /> Back to Vendors
            </button>

            <div className="vendor-detail__top">
                <div className="vendor-detail__card">
                    <h3 className="vendor-detail__card-title"><Building2 size={18} /> Vendor Details</h3>
                    <h2 className="vendor-detail__name">{vendor.name}</h2>

                    {vendor.gstin && (
                        <p className="vendor-detail__gstin">GSTIN: <span className="mono">{vendor.gstin}</span></p>
                    )}
                    {vendor.pan && (
                        <p className="vendor-detail__gstin">PAN: <span className="mono">{vendor.pan}</span></p>
                    )}

                    {(vendor.address || vendor.city || vendor.state) && (
                        <div className="vendor-detail__address">
                            <MapPin size={14} />
                            <div>
                                {vendor.address && <span>{vendor.address}</span>}
                                {(vendor.city || vendor.state || vendor.pincode) && (
                                    <span>{[vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', ')}</span>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="vendor-detail__contact">
                        {vendor.contact && <p><strong>Contact Person:</strong> {vendor.contact}</p>}
                        {vendor.phone && <p><Phone size={13} /> <strong>Phone:</strong> {vendor.phone}</p>}
                        {vendor.contact1 && <p><Phone size={13} /> <strong>Contact 1:</strong> {vendor.contact1}</p>}
                        {vendor.contact2 && <p><Phone size={13} /> <strong>Contact 2:</strong> {vendor.contact2}</p>}
                        {vendor.email && <p><Mail size={13} /> <strong>Email:</strong> {vendor.email}</p>}
                    </div>

                    <div className="vendor-detail__meta">
                        {vendor.created_by_name && <p><strong>Created By:</strong> {vendor.created_by_name}</p>}
                        <p><strong>Created:</strong> {formatDate(vendor.createdAt)}</p>
                    </div>
                </div>

                <div className="vendor-detail__card">
                    <h3 className="vendor-detail__card-title"><CreditCard size={18} /> Bank Details</h3>
                    {bank.account_number ? (
                        <div className="vendor-detail__bank">
                            <div className="vendor-detail__bank-row">
                                <span>Account Number</span>
                                <strong>{maskAccount(bank.account_number)}</strong>
                            </div>
                            {bank.ifsc_code && (
                                <div className="vendor-detail__bank-row">
                                    <span>IFSC Code</span>
                                    <strong className="mono">{bank.ifsc_code}</strong>
                                </div>
                            )}
                            {bank.bank_name && (
                                <div className="vendor-detail__bank-row">
                                    <span>Bank Name</span>
                                    <strong>{bank.bank_name}</strong>
                                </div>
                            )}
                            {bank.branch_name && (
                                <div className="vendor-detail__bank-row">
                                    <span>Branch</span>
                                    <strong>{bank.branch_name}</strong>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="vendor-detail__empty">No bank details added</p>
                    )}
                </div>
            </div>

            {/* Linked Products */}
            <div className="vendor-detail__products-card">
                <h3 className="vendor-detail__card-title"><Package size={18} /> Linked Products</h3>
                <div className="page-card__table">
                    <table>
                        <thead>
                            <tr>
                                <th>Product Name</th>
                                <th>HSN</th>
                                <th className="text-right">Rate</th>
                                <th>Unit</th>
                                <th>GST %</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {products.map((p) => (
                                <tr key={p.id || p._id}>
                                    <td className="font-medium">{p.name}</td>
                                    <td className="mono">{p.hsn || '-'}</td>
                                    <td className="text-right">{formatCurrency(p.rate)}</td>
                                    <td>{p.unit || '-'}</td>
                                    <td>{p.gst != null ? `${p.gst}%` : '-'}</td>
                                    <td>{p.status || '-'}</td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr><td colSpan={6} className="text-center">No linked products</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
