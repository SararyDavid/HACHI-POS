import React, { useState } from 'react';
import { Lock, Unlock, User, ShieldCheck, X, Check, Delete, ArrowRight } from 'lucide-react';
import { playScanBeep, playRegisterChime, playErrorBoop } from '../utils/audio';
import { loginWithPin } from '../api';

const CASHIERS = [
  { id: 'c1', name: 'Alex S.', role: 'Senior Cashier', pin: '1234', avatarColor: 'bg-sky-400' },
  { id: 'c2', name: 'David S.', role: 'Store Manager', pin: '9999', avatarColor: 'bg-indigo-500' },
  { id: 'c3', name: 'Srey Mao', role: 'Junior Cashier', pin: '0000', avatarColor: 'bg-pink-400' }
];

export default function PinLoginModal({ isOpen, onClose, currentCashier, onLoginSuccess }) {
  const [selectedUser, setSelectedUser] = useState(CASHIERS[0]);
  const [enteredPin, setEnteredPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleKeyPress = (num) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);
      playScanBeep();
      setErrorMsg('');

      // Auto-submit on 4th digit
      if (nextPin.length === 4) {
        verifyPin(nextPin, selectedUser);
      }
    }
  };

  const handleDelete = () => {
    setEnteredPin(prev => prev.slice(0, -1));
    setErrorMsg('');
  };

  const handleClear = () => {
    setEnteredPin('');
    setErrorMsg('');
  };

  const verifyPin = async (pin, user) => {
    try {
      // 1. Authenticate with server to acquire cryptographic JWT
      const res = await loginWithPin(pin);
      if (res?.success && res.data?.user) {
        playRegisterChime();
        onLoginSuccess(res.data.user.name, res.data.user.role);
        setEnteredPin('');
        setErrorMsg('');
        if (onClose) onClose();
        return;
      }
    } catch (err) {
      // If server returned 401 or network error
      if (err.response?.status === 401) {
        playErrorBoop();
        setErrorMsg('Incorrect PIN. Please try again.');
        setTimeout(() => setEnteredPin(''), 600);
        return;
      }
    }

    // 2. Offline fallback check
    if (pin === user.pin) {
      playRegisterChime();
      onLoginSuccess(user.name, user.role);
      setEnteredPin('');
      setErrorMsg('');
      if (onClose) onClose();
    } else {
      playErrorBoop();
      setErrorMsg('Incorrect PIN. Please try again.');
      setTimeout(() => setEnteredPin(''), 600);
    }
  };

  const handleQuickLogin = (user) => {
    setSelectedUser(user);
    verifyPin(user.pin, user);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-white rounded-3xl shadow-modal w-full max-w-sm overflow-hidden border border-sky-100 flex flex-col">
        
        {/* Header */}
        <div className="p-4 bg-sky-50 border-b border-sky-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">Terminal Authentication</h3>
              <p className="text-[11px] text-slate-400">Cashier shift sign-in</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-sky-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* User Selection Pills */}
        <div className="p-4 space-y-3">
          <div className="flex items-center space-x-2">
            {CASHIERS.map(user => {
              const isSelected = selectedUser.id === user.id;
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedUser(user);
                    setEnteredPin('');
                    setErrorMsg('');
                  }}
                  className={`flex-1 p-2 rounded-2xl border text-left transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-200' 
                      : 'bg-white border-slate-200 hover:border-sky-200'
                  }`}
                >
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2 h-2 rounded-full ${user.avatarColor}`}></span>
                    <span className="font-bold text-xs text-slate-800 truncate">{user.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{user.role}</span>
                </button>
              );
            })}
          </div>

          {/* PIN Dots Display */}
          <div className="py-2 text-center">
            <p className="text-xs font-semibold text-slate-500 mb-2">
              Enter 4-digit PIN for <span className="font-bold text-sky-600">{selectedUser.name}</span>
            </p>
            
            <div className="flex justify-center space-x-3 my-2">
              {[0, 1, 2, 3].map(idx => (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-150 ${
                    enteredPin.length > idx
                      ? 'bg-sky-500 scale-110 shadow-xs'
                      : 'border-2 border-slate-300 bg-slate-50'
                  }`}
                />
              ))}
            </div>

            {errorMsg ? (
              <p className="text-xs font-bold text-rose-500 mt-1 animate-bounce">{errorMsg}</p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-1">
                Default PIN: <code className="bg-sky-50 px-1 py-0.5 rounded text-sky-600 font-mono font-bold">{selectedUser.pin}</code>
              </p>
            )}
          </div>

          {/* Touch-Friendly Numpad Grid */}
          <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto pt-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeyPress(String(num))}
                className="h-12 rounded-2xl bg-slate-50 hover:bg-sky-100 active:scale-95 text-slate-800 font-mono font-black text-lg transition-all flex items-center justify-center border border-slate-200 hover:border-sky-300 cursor-pointer shadow-2xs"
              >
                {num}
              </button>
            ))}

            {/* Clear Button */}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-2xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 font-bold text-xs transition-all flex items-center justify-center border border-rose-200 cursor-pointer shadow-2xs"
            >
              CLEAR
            </button>

            {/* 0 Button */}
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className="h-12 rounded-2xl bg-slate-50 hover:bg-sky-100 active:scale-95 text-slate-800 font-mono font-black text-lg transition-all flex items-center justify-center border border-slate-200 hover:border-sky-300 cursor-pointer shadow-2xs"
            >
              0
            </button>

            {/* Backspace Button */}
            <button
              type="button"
              onClick={handleDelete}
              className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 transition-all flex items-center justify-center border border-slate-300 cursor-pointer shadow-2xs"
              title="Delete"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          {/* Fast 1-Tap Demo Switcher */}
          <div className="pt-2 border-t border-sky-100 flex justify-between items-center text-[11px]">
            <span className="text-slate-400 font-medium">Quick Demo Sign-In:</span>
            <div className="flex space-x-1.5">
              <button
                type="button"
                onClick={() => handleQuickLogin(CASHIERS[0])}
                className="px-2 py-0.5 rounded-lg bg-sky-100 text-sky-700 font-bold hover:bg-sky-200 transition-colors cursor-pointer"
              >
                Alex S. (Cashier)
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin(CASHIERS[1])}
                className="px-2 py-0.5 rounded-lg bg-indigo-100 text-indigo-700 font-bold hover:bg-indigo-200 transition-colors cursor-pointer"
              >
                David S. (Mgr)
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
