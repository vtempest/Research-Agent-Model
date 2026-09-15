/**
 * @fileoverview Reusable image-picker hook. Owns the hidden file input, the
 * local object-URL preview and its cleanup, so callers only deal with a
 * preview URL and the picked `File`.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseImageUploadProps {
  /** Called with a local object URL and the picked file whenever a new image is selected. */
  onUpload?: (url: string, file: File) => void;
}

export function useImageUpload({ onUpload }: UseImageUploadProps = {}) {
  const previewRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleThumbnailClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** Accepts a File directly, so drag-and-drop and the input share one path. */
  const handleFileSelect = useCallback(
    (file: File) => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
      const url = URL.createObjectURL(file);
      previewRef.current = url;
      setFileName(file.name);
      setPreviewUrl(url);
      onUpload?.(url, file);
    },
    [onUpload],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) handleFileSelect(file);
      // Allow re-picking the same file straight after a removal.
      event.target.value = '';
    },
    [handleFileSelect],
  );

  const handleRemove = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
    }
    previewRef.current = null;
    setPreviewUrl(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  return {
    previewUrl,
    fileName,
    fileInputRef,
    handleThumbnailClick,
    handleFileSelect,
    handleFileChange,
    handleRemove,
  };
}
