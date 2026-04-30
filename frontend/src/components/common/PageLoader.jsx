import { Loader2 } from 'lucide-react';

export default function PageLoader() {
    return (
        <div className="page-loader">
            <div className="page-loader__spinner">
                <Loader2 size={28} strokeWidth={2.5} />
            </div>
        </div>
    );
}
