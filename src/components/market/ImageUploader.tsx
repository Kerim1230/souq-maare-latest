'use client';

import React, { useRef, useState } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImageUploaderProps {
  value: string | null;
  onChange: (_base64: string | null) => void;
  label?: string;
  height?: string;
}

const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL(file.type || 'image/jpeg', quality));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  value,
  onChange,
  label,
  height = 'h-32',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size validation: max 5MB (must match server MAX_SIZE_MB in /api/upload-image)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('حجم الملف يتجاوز 5 ميغابايت. يرجى اختيار صورة أصغر.');
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setCompressing(true);
    try {
      const base64 = await compressImage(file);
      onChange(base64);
    } catch {
      onChange(null);
    } finally {
      setCompressing(false);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  return (
    <div>
      {label && (
        <label className="text-[13px] font-bold text-emerald-900 block mb-1.5">{label}</label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      {value ? (
        <div className={`relative ${height} rounded-xl overflow-hidden border border-emerald-100/60 group`}>
          <img
            src={value}
            alt="صورة مرفوعة"
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-2 left-2 w-7 h-7 bg-red-500/90 backdrop-blur-sm rounded-lg flex items-center justify-center text-white opacity-70 hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-full ${height} rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all`}
        >
          {compressing ? (
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
          ) : (
            <>
              <div className="w-10 h-10 bg-emerald-100/60 rounded-xl flex items-center justify-center">
                <Camera className="w-5 h-5 text-emerald-400" />
              </div>
              <span className="text-[12px] font-medium text-emerald-500">اضغط لرفع صورة</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};
