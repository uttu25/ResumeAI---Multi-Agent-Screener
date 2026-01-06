import React, { useState, useRef } from 'react';
import { X, User, Camera, Key, Save } from 'lucide-react';
import { UserProfile } from '../types';

interface SettingsModalProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onUpdateUser: (updatedUser: UserProfile) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ user, isOpen, onClose, onUpdateUser }) => {
  const [name, setName] = useState(user.name);
  const [apiKey, setApiKey] = useState(user.apiKey || '');
  const [activeTab, setActiveTab] = useState<'profile' | 'api'>('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdateUser({ ...user, avatarUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    onUpdateUser({ ...user, name, apiKey: apiKey.trim() || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-4 px-6 border-b border-slate-800">
           <button 
             onClick={() => setActiveTab('profile')}
             className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
               activeTab === 'profile' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
             }`}
           >
             Profile
           </button>
           <button 
             onClick={() => setActiveTab('api')}
             className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
               activeTab === 'api' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
             }`}
           >
             API Configuration
           </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              
              {/* Avatar Section */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-slate-700 bg-slate-800 flex items-center justify-center">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-12 h-12 text-slate-500" />
                    )}
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-full transition-opacity cursor-pointer"
                  >
                    <Camera className="w-8 h-8 text-white" />
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">Click image to upload new picture</p>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Gmail Account</label>
                  <input
                    type="text"
                    value={user.email}
                    disabled
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-lg p-3 text-slate-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500 mt-1">Managed via Google Sign-In</p>
                </div>
              </div>
            </div>
          )}

          {/* API Tab */}
          {activeTab === 'api' && (
            <div className="space-y-4">
              <div className="bg-primary-500/10 border border-primary-500/20 p-4 rounded-lg">
                <p className="text-sm text-primary-200">
                  <span className="font-bold block mb-1">Advanced Setting</span>
                  By default, the application uses the system API key. You can override it here if you have your own high-throughput Gemini API key.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Gemini API Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    placeholder="Enter your API Key (starts with AIza...)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg font-medium shadow-lg shadow-primary-500/20 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;
