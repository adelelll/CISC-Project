/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { 
  Camera, 
  Upload, 
  MapPin, 
  Compass, 
  History, 
  Utensils, 
  TreePine, 
  ShoppingBag, 
  Mountain, 
  ArrowRight, 
  RefreshCw,
  Coins,
  Wallet,
  Navigation,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

type Category = 'food' | 'adventure' | 'culture & history' | 'shopping' | 'nature';

interface LandmarkInfo {
  name: string;
  info: string;
  location?: string;
}

interface Attraction {
  name: string;
  description: string;
}

interface RouteInfo {
  route: string;
  localPrice: string;
  chosenPrice: string;
}

type AppState = 
  | 'initial' 
  | 'identifying' 
  | 'landmark_info' 
  | 'attractions_info' 
  | 'budget_info' 
  | 'final_route';

export default function App() {
  const [state, setState] = useState<AppState>('initial');
  const [image, setImage] = useState<string | null>(null);
  const [landmark, setLandmark] = useState<LandmarkInfo | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [currency, setCurrency] = useState<string>('USD');
  const [nextLocation, setNextLocation] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        identifyLandmark(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const identifyLandmark = async (base64Img: string) => {
    setState('identifying');
    setLoading(true);
    setError(null);

    try {
      const base64Data = base64Img.split(',')[1];
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
            { text: "Identify this landmark. Provide its name and 1-2 sentences of cultural and historical information. Return as JSON with keys 'name' and 'info'." }
          ]
        },
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text || '{}');
      setLandmark(data);
      setState('landmark_info');
    } catch (err) {
      console.error(err);
      setError("I couldn't identify that landmark. Please try another photo.");
      setState('initial');
    } finally {
      setLoading(false);
    }
  };

  const getAttractions = async () => {
    if (!landmark || selectedCategories.length === 0) return;
    setLoading(true);
    setState('attractions_info');

    try {
      let latLng = undefined;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
        });
        latLng = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      } catch (e) {
        console.log("Geolocation not available or denied, using landmark name only.");
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I am at ${landmark.name}. I am interested in ${selectedCategories.join(', ')}. Recommend 1-2 attractions within 2km of ${landmark.name} relevant to these categories. Provide 1-2 sentences for each. Return your response ONLY as a JSON array of objects with 'name' and 'description'. Do not include markdown formatting like \`\`\`json.`,
        config: { 
          tools: [{ googleMaps: {} }],
          toolConfig: latLng ? {
            retrievalConfig: { latLng }
          } : undefined
        }
      });

      const text = response.text || '[]';
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const data = JSON.parse(jsonStr);
      setAttractions(data);
    } catch (err) {
      console.error(err);
      setError("Something went wrong while finding attractions.");
    } finally {
      setLoading(false);
    }
  };

  const getRouteAndBudget = async () => {
    if (!landmark || !nextLocation || !budget) return;
    setLoading(true);
    setState('final_route');

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I am at ${landmark.name}. I want to go to ${nextLocation}. My budget is ${budget} ${currency}. Recommend the best route and estimate prices in both the local currency of ${landmark.name} and my preferred currency (${currency}). Ensure the total is under my budget. Return your response ONLY as a JSON object with keys 'route', 'localPrice', 'chosenPrice'. Do not include markdown formatting like \`\`\`json.`,
        config: { 
          tools: [{ googleMaps: {} }]
        }
      });

      const text = response.text || '{}';
      const jsonStr = text.replace(/```json|```/g, '').trim();
      const data = JSON.parse(jsonStr);
      setRouteInfo(data);
    } catch (err) {
      console.error(err);
      setError("I couldn't calculate the route. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setState('initial');
    setImage(null);
    setLandmark(null);
    setSelectedCategories([]);
    setAttractions([]);
    setNextLocation('');
    setBudget('');
    setRouteInfo(null);
    setError(null);
  };

  const categories: { id: Category; icon: any; label: string }[] = [
    { id: 'food', icon: Utensils, label: 'Food' },
    { id: 'adventure', icon: Mountain, label: 'Adventure' },
    { id: 'culture & history', icon: History, label: 'Culture & History' },
    { id: 'shopping', icon: ShoppingBag, label: 'Shopping' },
    { id: 'nature', icon: TreePine, label: 'Nature' },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center p-6 md:p-12">
      <header className="w-full max-w-2xl mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <div className="w-16 h-16 bg-brand-olive rounded-full flex items-center justify-center mb-4 shadow-lg">
            <Compass className="text-brand-cream w-8 h-8" />
          </div>
          <h1 className="text-5xl font-bold text-brand-olive mb-2">Roami</h1>
          <p className="text-lg text-gray-600 italic">Your friendly personalized travel companion</p>
        </motion.div>
      </header>

      <main className="w-full max-w-2xl bg-brand-paper rounded-xl shadow-xl overflow-hidden border border-gray-100">
        <AnimatePresence mode="wait">
          {state === 'initial' && (
            <motion.div
              key="initial"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8 text-center"
            >
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-12 cursor-pointer hover:border-brand-olive transition-colors group"
              >
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-brand-cream transition-colors">
                  <Camera className="w-10 h-10 text-gray-400 group-hover:text-brand-olive" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Identify a Landmark</h2>
                <p className="text-gray-500 mb-6">Upload or take a photo of a landmark to start your journey</p>
                <button className="bg-brand-olive text-white px-8 py-3 rounded-full font-medium hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto">
                  <Upload className="w-4 h-4" />
                  Choose Photo
                </button>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
              </div>
              {error && <p className="mt-4 text-red-500 text-sm">{error}</p>}
            </motion.div>
          )}

          {state === 'identifying' && (
            <motion.div
              key="identifying"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-12 text-center"
            >
              <div className="relative w-48 h-48 mx-auto mb-8">
                {image && <img src={image} className="w-full h-full object-cover rounded-xl opacity-50" referrerPolicy="no-referrer" />}
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-12 h-12 text-brand-olive animate-spin" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold mb-2">Identifying...</h2>
              <p className="text-gray-500 italic">Roami is looking through its travel journals...</p>
            </motion.div>
          )}

          {state === 'landmark_info' && landmark && (
            <motion.div
              key="landmark_info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <div className="flex items-start gap-6 mb-8">
                {image && <img src={image} className="w-32 h-32 object-cover rounded-xl shadow-md" referrerPolicy="no-referrer" />}
                <div>
                  <div className="flex items-center gap-2 text-brand-olive mb-1">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm font-semibold uppercase tracking-wider">Landmark Identified</span>
                  </div>
                  <h2 className="text-3xl font-bold mb-2">{landmark.name}</h2>
                  <p className="text-gray-600 leading-relaxed italic">"{landmark.info}"</p>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-xl font-semibold mb-4">What are you in the mood for?</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategories(prev => 
                          prev.includes(cat.id) 
                            ? prev.filter(c => c !== cat.id) 
                            : [...prev, cat.id]
                        );
                      }}
                      className={cn(
                        "flex flex-col items-center p-4 rounded-xl border transition-all",
                        selectedCategories.includes(cat.id)
                          ? "bg-brand-olive text-white border-brand-olive shadow-md"
                          : "bg-white text-gray-600 border-gray-100 hover:border-brand-olive/30"
                      )}
                    >
                      <cat.icon className={cn("w-6 h-6 mb-2", selectedCategories.includes(cat.id) ? "text-white" : "text-brand-olive")} />
                      <span className="text-xs font-medium text-center">{cat.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  disabled={selectedCategories.length === 0 || loading}
                  onClick={getAttractions}
                  className="w-full bg-brand-olive text-white py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Find Attractions"}
                  {!loading && <ArrowRight className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          )}

          {state === 'attractions_info' && (
            <motion.div
              key="attractions_info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Compass className="text-brand-olive" />
                Nearby Gems
              </h2>
              
              <div className="space-y-6 mb-10">
                {attractions.map((attr, i) => (
                  <div key={i} className="bg-brand-cream/30 p-6 rounded-xl border border-brand-olive/10">
                    <h3 className="text-lg font-bold mb-2 text-brand-olive">{attr.name}</h3>
                    <p className="text-gray-600 leading-relaxed">{attr.description}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-8">
                <h3 className="text-xl font-semibold mb-4">Where to next?</h3>
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Preferred Currency</label>
                    <div className="relative">
                      <Coins className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select 
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-olive/20 focus:border-brand-olive appearance-none"
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="EUR">EUR - Euro</option>
                        <option value="GBP">GBP - British Pound</option>
                        <option value="JPY">JPY - Japanese Yen</option>
                        <option value="AUD">AUD - Australian Dollar</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Next Destination</label>
                    <div className="relative">
                      <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input 
                        type="text" 
                        placeholder="Where are you heading?"
                        value={nextLocation}
                        onChange={(e) => setNextLocation(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-olive/20 focus:border-brand-olive"
                      />
                    </div>
                  </div>
                </div>

                <button
                  disabled={!nextLocation}
                  onClick={() => setState('budget_info')}
                  className="w-full bg-brand-olive text-white py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Continue to Budget
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          )}

          {state === 'budget_info' && (
            <motion.div
              key="budget_info"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-brand-cream rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet className="text-brand-olive w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Plan Your Route</h2>
                <p className="text-gray-500">How much are you looking to spend for this leg of the trip?</p>
              </div>

              <div className="mb-8">
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1 ml-1">Your Budget ({currency})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">{currency === 'USD' ? '$' : currency}</span>
                  <input 
                    type="number" 
                    placeholder="Enter amount"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-xl font-bold focus:outline-none focus:ring-2 focus:ring-brand-olive/20 focus:border-brand-olive"
                  />
                </div>
              </div>

              <button
                disabled={!budget || loading}
                onClick={getRouteAndBudget}
                className="w-full bg-brand-olive text-white py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Calculate Best Route"}
                {!loading && <ArrowRight className="w-5 h-5" />}
              </button>
            </motion.div>
          )}

          {state === 'final_route' && routeInfo && (
            <motion.div
              key="final_route"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-8"
            >
              <div className="bg-brand-olive text-white p-8 rounded-xl mb-8 shadow-lg">
                <div className="flex items-center gap-2 mb-4 opacity-80">
                  <Navigation className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-widest">Recommended Route</span>
                </div>
                <h2 className="text-2xl font-bold mb-4 leading-tight">{routeInfo.route}</h2>
                <div className="flex gap-4 border-t border-white/20 pt-4">
                  <div>
                    <p className="text-[10px] uppercase opacity-70 mb-1">Local Price</p>
                    <p className="text-xl font-bold">{routeInfo.localPrice}</p>
                  </div>
                  <div className="w-px bg-white/20" />
                  <div>
                    <p className="text-[10px] uppercase opacity-70 mb-1">Your Currency ({currency})</p>
                    <p className="text-xl font-bold">{routeInfo.chosenPrice}</p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <p className="text-gray-500 mb-6 italic">Ready for another adventure?</p>
                <button
                  onClick={reset}
                  className="bg-brand-cream text-brand-olive px-8 py-3 rounded-full font-semibold border border-brand-olive/20 hover:bg-brand-olive hover:text-white transition-all flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className="w-4 h-4" />
                  Start New Search
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-12 text-gray-400 text-sm">
        <p>&copy; 2026 Roami Travel Guide. Powered by Gemini AI.</p>
      </footer>
    </div>
  );
}
