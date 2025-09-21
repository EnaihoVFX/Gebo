import React, { useState } from 'react';
import { Key, Eye, EyeOff, Check, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface ApiKeyManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onApiKeySet?: () => void;
}

export function ApiKeyManager({ isOpen, onClose, onApiKeySet }: ApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsLoading(true);
    setStatus('idle');

    try {
      await invoke('set_gemini_api_key', { apiKey: apiKey.trim() });
      setStatus('success');
      onApiKeySet?.();
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
        setApiKey('');
        setStatus('idle');
      }, 1500);
    } catch (error) {
      console.error('Failed to set API key:', error);
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setApiKey('');
    setStatus('idle');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-editor-bg-glass-primary backdrop-blur-2xl border border-editor-border-tertiary rounded-xl p-6 w-full max-w-md mx-4 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-editor-bg-glass-tertiary backdrop-blur-xl rounded-lg flex items-center justify-center border border-editor-border-tertiary">
            <Key className="w-5 h-5 text-editor-status-info" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-editor-text-primary">Gemini API Key</h3>
            <p className="text-sm text-editor-text-tertiary">Configure your Google Gemini API key</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-slate-300 mb-2">
              API Key
            </label>
            <div className="relative">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="w-full px-3 py-2 pr-10 bg-editor-bg-canvas border border-editor-border-tertiary rounded-lg text-editor-text-primary placeholder-editor-text-muted focus:outline-none focus:border-editor-border-accent focus:ring-1 focus:ring-editor-border-accent"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                disabled={isLoading}
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Your API key is stored locally and only used for AI processing.
            </p>
          </div>

          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-600/10 border border-green-600/20 rounded-lg">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400">API key set successfully!</span>
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-600/10 border border-red-600/20 rounded-lg">
              <X className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">Failed to set API key. Please try again.</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!apiKey.trim() || isLoading}
              className="flex-1 px-4 py-2 bg-editor-bg-glass-tertiary backdrop-blur-xl hover:bg-editor-interactive-hover disabled:bg-editor-interactive-disabled text-editor-text-primary rounded-lg transition-colors flex items-center justify-center gap-2 border border-editor-border-tertiary hover:border-editor-border-secondary"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Setting...
                </>
              ) : (
                'Set API Key'
              )}
            </button>
          </div>
        </form>

        <div className="mt-4 p-3 bg-editor-bg-glass-tertiary backdrop-blur-xl rounded-lg border border-editor-border-tertiary">
          <h4 className="text-sm font-medium text-editor-text-secondary mb-2">How to get your API key:</h4>
          <ol className="text-xs text-editor-text-tertiary space-y-1 list-decimal list-inside">
            <li>Go to <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-editor-status-info hover:underline">Google AI Studio</a></li>
            <li>Sign in with your Google account</li>
            <li>Click "Create API Key"</li>
            <li>Copy the generated key and paste it here</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

