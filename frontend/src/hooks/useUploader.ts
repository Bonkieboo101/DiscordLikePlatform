import axios, { Canceler } from 'axios';
import { useRef, useState } from 'react';
import api from '../utils/api';

export type AttachmentInfo = { url: string; filename: string; mimeType: string; size: number };

export type FileUploadState = {
  file: File;
  progress: number;
  status: 'idle' | 'uploading' | 'done' | 'error';
  info?: AttachmentInfo;
  error?: string;
  cancel?: Canceler;
};

export function useUploader() {
  const [uploads, setUploads] = useState<FileUploadState[]>([]);
  const controllersRef = useRef<Record<number, Canceler>>({});

  function addFiles(files: File[]) {
    const next = files.map((f) => ({ file: f, progress: 0, status: 'idle' as const }));
    setUploads((u) => [...u, ...next]);
  }

  async function uploadAll(): Promise<AttachmentInfo[]> {
    const infos: AttachmentInfo[] = [];
    for (let i = 0; i < uploads.length; i++) {
      const u = uploads[i];
      if (u.status === 'done') { if (u.info) infos.push(u.info); continue; }
      try {
        await uploadIndex(i);
        if (uploads[i].info) infos.push(uploads[i].info!);
      } catch (err) {
        // ignore - caller can handle
      }
    }
    return infos;
  }

  function clear() { setUploads([]); controllersRef.current = {}; }

  async function uploadIndex(idx: number) {
    setUploads((u) => u.map((s, i) => i === idx ? { ...s, status: 'uploading', progress: 0, error: undefined } : s));
    const file = uploads[idx].file;
    const cancelToken = new axios.CancelToken((c) => { controllersRef.current[idx] = c; });

    try {
      // request presigned URL
      const presign = await api.post('/upload-presign', { filename: file.name, contentType: file.type || 'application/octet-stream' });
      const { url, publicUrl } = presign.data;
      // upload directly to S3
      await axios.put(url, file, {
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        cancelToken,
        onUploadProgress: (ev) => {
          const pct = ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0;
          setUploads((u) => u.map((s, i) => i === idx ? { ...s, progress: pct } : s));
        }
      });
      const info: AttachmentInfo = { url: publicUrl || url.split('?')[0], filename: file.name, mimeType: file.type || 'application/octet-stream', size: file.size };
      setUploads((u) => u.map((s, i) => i === idx ? { ...s, status: 'done', progress: 100, info } : s));
      return info;
    } catch (err: any) {
      if (axios.isCancel(err)) {
        setUploads((u) => u.map((s, i) => i === idx ? { ...s, status: 'error', error: 'Canceled' } : s));
      } else {
        setUploads((u) => u.map((s, i) => i === idx ? { ...s, status: 'error', error: err?.message || 'Upload failed' } : s));
      }
      throw err;
    }
  }

  function cancel(idx: number) {
    const c = controllersRef.current[idx];
    if (c) c('canceled');
    setUploads((u) => u.map((s, i) => i === idx ? { ...s, status: 'error', error: 'Canceled' } : s));
  }

  function remove(idx: number) {
    setUploads((u) => u.filter((_, i) => i !== idx));
  }

  function retry(idx: number) {
    uploadIndex(idx);
  }

  const isUploading = uploads.some((u)=>u.status === 'uploading');
  const pendingCount = uploads.filter((u)=>u.status === 'idle' || u.status === 'uploading' || u.status === 'error').length;

  return {
    uploads,
    addFiles,
    uploadAll,
    clear,
    cancel,
    remove,
    retry,
    isUploading,
    pendingCount
  };
}
