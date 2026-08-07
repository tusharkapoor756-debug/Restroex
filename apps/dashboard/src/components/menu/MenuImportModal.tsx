import React, { useState, useRef, useEffect } from 'react';
import { getToken } from '../../lib/auth';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:4000';
const API_BASE = `${BACKEND_URL}/api/v1`;

interface StagedVariant {
  name: string;
  price: number;
}

interface StagedItem {
  id?: string;
  categoryName: string;
  itemName: string;
  basePrice: number | null;
  vegType: 'veg' | 'non-veg' | 'egg' | 'vegan';
  isBestseller: boolean;
  needsReview: boolean;
  variants: StagedVariant[];
  boundingBox?: { x0: number; y0: number; x1: number; y1: number } | null;
}

interface ParsedCategory {
  id: string;
  name: string;
  items: StagedItem[];
}

interface MenuImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MenuImportModal: React.FC<MenuImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStage, setProgressStage] = useState<string>('Idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [categories, setCategories] = useState<ParsedCategory[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<{ catIdx: number; itemIdx: number } | null>(null);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setImagePreviewUrl(URL.createObjectURL(selected));
    }
  };

  const handleUploadAndParse = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgressStage('Uploading image file...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressStage('Preprocessing & Local OCR Scanning...');

      const token = getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/menu/import/upload`, {
        method: 'POST',
        headers,
        body: formData
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || json.message || 'Failed to extract menu');
      }

      setProgressStage('Spatial Reconstruction & Deterministic Parsing...');

      setSessionId(json.data.sessionId);
      setCategories(json.data.categories || []);
      setProgressStage('Ready for Review');
    } catch (err: any) {
      alert(`Import Failed: ${err.message}`);
      setProgressStage('Failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleItemChange = (catIdx: number, itemIdx: number, field: keyof StagedItem, value: any) => {
    const updated = [...categories];
    const item = updated[catIdx]?.items[itemIdx];
    if (item) {
      (item as any)[field] = value;
      setCategories(updated);
    }
  };

  const handleCommit = async () => {
    if (!sessionId) return;
    setIsCommitting(true);

    try {
      const token = getToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/menu/import/sessions/${sessionId}/commit`, {
        method: 'POST',
        headers
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || json.message || 'Commit failed');
      }

      alert(`Menu imported successfully! Version #${json.data.versionNumber} snapshot created.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(`Commit error: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-900 text-white">
          <div>
            <h2 className="text-xl font-bold">Restroex Deterministic Menu Import Engine</h2>
            <p className="text-xs text-slate-400">100% Offline Local OCR & Spatial Parser — Zero AI APIs</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl font-bold">×</button>
        </div>

        {/* Body Grid */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-x divide-gray-200">
          {/* Left Column: Upload Dropzone & Canvas Overlay */}
          <div className="p-6 flex flex-col bg-slate-50 overflow-y-auto">
            <h3 className="font-semibold text-gray-800 mb-2">Original Menu Image & OCR Overlay</h3>

            {!imagePreviewUrl ? (
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center flex flex-col items-center justify-center bg-white my-auto">
                <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-gray-700 mb-1">Upload Menu File (Image, PDF, CSV, Excel, JSON)</p>
                <p className="text-xs text-gray-500 mb-4">PNG, JPEG, WebP, PDF, CSV, Excel (.xlsx/.xls), or JSON (up to 15MB)</p>
                <label className="cursor-pointer bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
                  Browse Files
                  <input type="file" onChange={handleFileChange} accept="image/*,.pdf,.csv,.xlsx,.xls,.json" className="hidden" />
                </label>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="relative border rounded-lg overflow-hidden bg-slate-900 flex-1 flex items-center justify-center p-4">
                  {file && file.type.startsWith('image/') ? (
                    <>
                      <img
                        id="menu-preview-img"
                        src={imagePreviewUrl}
                        alt="Menu Preview"
                        className="max-h-[450px] object-contain"
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (canvasRef.current) {
                            canvasRef.current.width = img.clientWidth;
                            canvasRef.current.height = img.clientHeight;
                          }
                        }}
                      />
                      <canvas
                        ref={canvasRef}
                        className="absolute inset-0 pointer-events-none w-full h-full"
                      />
                    </>
                  ) : (
                    <div className="text-center p-8 bg-slate-800 rounded-xl text-white max-w-sm">
                      <div className="text-4xl mb-3">📄</div>
                      <p className="font-semibold text-base truncate">{file?.name}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {file ? `${(file.size / 1024).toFixed(1)} KB` : ''} • Structured Data Document
                      </p>
                    </div>
                  )}
                </div>
                <button onClick={() => { setFile(null); setImagePreviewUrl(null); setCategories([]); }} className="mt-3 text-xs text-red-600 hover:underline">
                  Clear & Choose Different File
                </button>
              </div>
            )}


            {file && !sessionId && (
              <button
                onClick={handleUploadAndParse}
                disabled={isProcessing}
                className="mt-4 w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow transition"
              >
                {isProcessing ? progressStage : 'Extract Menu Items'}
              </button>
            )}
          </div>

          {/* Right Column: Editable Preview Grid */}
          <div className="p-6 flex flex-col overflow-y-auto bg-white">
            <h3 className="font-semibold text-gray-800 mb-2">Staged Extracted Menu Preview</h3>

            {categories.length === 0 ? (
              <div className="my-auto text-center text-gray-400 py-12">
                <p className="text-sm">Upload an image and click extract to preview menu items here.</p>
              </div>
            ) : (
              <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                {categories.map((cat, catIdx) => (
                  <div key={cat.id || catIdx} className="border border-gray-200 rounded-lg p-4 bg-slate-50">
                    <h4 className="font-bold text-gray-900 text-base mb-3 pb-1 border-b border-gray-200">
                      📂 {cat.name}
                    </h4>

                    <div className="space-y-3">
                      {cat.items.map((item, itemIdx) => (
                        <div
                          key={itemIdx}
                          className={`p-3 rounded-lg border transition ${
                            item.needsReview ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <select
                              value={item.vegType}
                              onChange={(e) => handleItemChange(catIdx, itemIdx, 'vegType', e.target.value)}
                              className="text-xs border rounded p-1"
                            >
                              <option value="veg">🟢 Veg</option>
                              <option value="non-veg">🔴 Non-Veg</option>
                              <option value="egg">🟡 Egg</option>
                              <option value="vegan">🌱 Vegan</option>
                            </select>

                            <input
                              type="text"
                              value={item.itemName}
                              onChange={(e) => handleItemChange(catIdx, itemIdx, 'itemName', e.target.value)}
                              className="flex-1 font-semibold text-sm border-b border-transparent hover:border-gray-300 focus:border-amber-600 focus:outline-none bg-transparent"
                            />

                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">₹</span>
                              <input
                                type="number"
                                value={item.basePrice || ''}
                                onChange={(e) => handleItemChange(catIdx, itemIdx, 'basePrice', parseFloat(e.target.value) || null)}
                                placeholder="Price"
                                className="w-20 text-sm font-semibold border rounded px-2 py-1"
                              />
                            </div>
                          </div>

                          {item.variants && item.variants.length > 0 && (
                            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100">
                              {item.variants.map((v, vIdx) => (
                                <span key={vIdx} className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                                  {v.name}: ₹{v.price}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {categories.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
                <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  disabled={isCommitting}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition"
                >
                  {isCommitting ? 'Importing...' : 'Import Menu & Save Snapshot'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
