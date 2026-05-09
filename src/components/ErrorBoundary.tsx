'use client';

import React, { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /** Called when the user clicks retry. Receives the reset function to clear the error state. */
  onReset?: (_reset: () => void) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  resetCount: number;
}

export class ErrorBoundary extends React.PureComponent<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, resetCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState(prev => ({ hasError: false, error: null, resetCount: prev.resetCount + 1 }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        // Pass reset function so custom fallbacks can trigger recovery
        if (typeof this.props.fallback === 'object' && React.isValidElement(this.props.fallback)) {
          return React.cloneElement(this.props.fallback as React.ReactElement<any>, {
            onReset: this.handleReset,
            error: this.state.error,
          });
        }
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-[#f7f6f3] p-6">
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 max-w-sm w-full shadow-lg text-center border border-stone-100">
            <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-[16px] font-black text-stone-800 mb-1.5">حدث خطأ غير متوقع</h2>
            <p className="text-[13px] text-stone-500 mb-3">عذراً، حدث خطأ أثناء تحميل التطبيق</p>
            {this.state.error && (
              <div className="bg-red-50 rounded-xl p-3 mb-4 border border-red-100">
                <p className="text-[11px] text-red-600 font-mono text-right break-all leading-relaxed">
                  {this.state.error.message}
                </p>
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return <React.Fragment key={this.state.resetCount}>{this.props.children}</React.Fragment>;
  }
}
