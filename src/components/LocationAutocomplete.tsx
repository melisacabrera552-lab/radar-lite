import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { getPlaceAutocomplete, PlacePrediction } from '../services/api';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (prediction: PlacePrediction) => void;
  placeholder?: string;
  className?: string;
  apiKey?: string;
  disabled?: boolean;
  id?: string;
}

export const LocationAutocomplete: React.FC<Props> = ({
  value,
  onChange,
  onSelect,
  placeholder = 'Buscar ciudad o zona (ej: Santa Rosa, La Pampa)...',
  className = '',
  apiKey,
  disabled = false,
  id,
}) => {
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Debounced autocomplete fetch
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onChange(query);
    setSelectedIndex(-1);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await getPlaceAutocomplete(query, apiKey);
        setSuggestions(results);
        setIsOpen(results.length > 0);
      } catch (err) {
        console.error('Error fetching location autocomplete:', err);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 280);
  };

  const handleSelectSuggestion = (prediction: PlacePrediction) => {
    onChange(prediction.text);
    if (onSelect) {
      onSelect(prediction);
    }
    setIsOpen(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  };

  const handleClear = () => {
    onChange('');
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-50' : 'z-10'}`}>
      <div className="relative">
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={
            className ||
            'w-full bg-black/60 border border-white/15 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#7d39eb] focus:ring-1 focus:ring-[#7d39eb] transition-all'
          }
        />

        {/* Status indicator: loader or clear button */}
        <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 text-[#c6ff33] animate-spin shrink-0" />
          )}
          {!isLoading && value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer p-0.5 rounded-full hover:bg-white/10"
              title="Limpiar ubicación"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-[100] bg-[#0c0a17] border border-white/20 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] overflow-hidden py-1.5 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between border-b border-white/5 mb-1">
            <span>Ubicaciones sugeridas</span>
            <span className="text-[#c6ff33] text-[9px] font-normal lowercase">Google Places</span>
          </div>

          {suggestions.map((item, index) => {
            const isSelected = index === selectedIndex;
            return (
              <button
                key={item.placeId || `${item.text}-${index}`}
                type="button"
                onClick={() => handleSelectSuggestion(item)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full px-3 py-2 text-left flex items-start gap-2.5 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[#7d39eb]/25 text-white border-l-2 border-[#c6ff33]'
                    : 'text-slate-200 hover:bg-white/[0.07]'
                }`}
              >
                <MapPin
                  className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${
                    isSelected ? 'text-[#c6ff33]' : 'text-[#b9a0ff]'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate leading-tight">
                    {item.mainText || item.text || (item as any).placePrediction?.structuredFormat?.mainText?.text || (item as any).placePrediction?.text?.text || "Ubicación"}
                  </div>
                  {(item.secondaryText || (item as any).placePrediction?.structuredFormat?.secondaryText?.text) && (
                    <div className="text-[11px] text-slate-400 truncate leading-tight mt-0.5">
                      {item.secondaryText || (item as any).placePrediction?.structuredFormat?.secondaryText?.text}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

