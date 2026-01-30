import React, { Fragment } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    className?: string;
    maxWidth?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className, maxWidth = "max-w-lg" }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <div className="fixed inset-0 bg-slate-900/50 transition-opacity" onClick={onClose} />

            <div className={cn("relative w-full transform rounded-xl bg-white p-6 text-left shadow-xl transition-all flex flex-col max-h-[90vh]", maxWidth, className)}>
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-semibold leading-6 text-slate-900">
                        {title}
                    </h3>
                    <button
                        type="button"
                        className="rounded-md bg-white text-slate-400 hover:text-slate-500 focus:outline-none"
                        onClick={onClose}
                    >
                        <span className="sr-only">Close</span>
                        <X className="h-6 w-6" aria-hidden="true" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;
