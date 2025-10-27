import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
// CSS is imported in main.jsx

// --- Helper function to generate API key ---
function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// --- Helper: Get base domain ---
function getBaseDomain(urlString) {
    if (!urlString) return null;
    try {
        let fullUrl = urlString.trim();
        if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
            fullUrl = 'http://' + fullUrl;
        }
        const url = new URL(fullUrl);
        const parts = url.hostname.split('.');
        if (parts.length >= 2) {
            if (parts.length > 2 && parts[parts.length - 2].length <= 3 && parts[parts.length - 1].length <= 3) {
                 return parts.slice(-3).join('.').toLowerCase(); // e.g., bbc.co.uk
            }
            return parts.slice(-2).join('.').toLowerCase(); // e.g., google.com
        }
        return url.hostname.toLowerCase();
    } catch (e) {
        console.warn("Could not parse domain:", urlString);
        return null;
    }
}

// === Define categories for checkboxes ===
const BLOCKED_CATEGORIES = [
    { id: 'social', label: 'Social Media (Facebook, Instagram, TikTok, etc.)' },
    { id: 'news', label: 'News & Politics' },
    { id: 'entertainment', label: 'Entertainment (Streaming, non-educational YouTube)' },
    { id: 'games', label: 'Games' },
    { id: 'shopping', label: 'Online Shopping (General)' },
    { id: 'mature', label: 'Mature Content (Violence, Adult Themes, etc.)' }
];

// === Map common names to domains ===
const commonSiteMappings = {
    'wikipedia': 'wikipedia.org', 'youtube': 'youtube.com', 'facebook': 'facebook.com',
    'instagram': 'instagram.com', 'twitter': 'twitter.com', 'x': 'x.com',
    'reddit': 'reddit.com', 'amazon': 'amazon.com', 'google': 'google.com',
    'bbc': 'bbc.com', 'cnn': 'cnn.com', 'nytimes': 'nytimes.com', 'tiktok': 'tiktok.com',
};

// === Dashboard Component ===
function Dashboard({ session }) {
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState(null);
    const [apiKey, setApiKey] = useState(null);
    const [mainPrompt, setMainPrompt] = useState('');
    const [blockedCategories, setBlockedCategories] = useState({});
    const [allowListArray, setAllowListArray] = useState([]);
    const [blockListArray, setBlockListArray] = useState([]);
    const [currentAllowInput, setCurrentAllowInput] = useState('');
    const [currentBlockInput, setCurrentBlockInput] = useState('');
    const mainPromptRef = useRef(null);

    // --- Auto-Resize Handler for Main Prompt ---
const handleTextAreaChange = (event) => {
  const textarea = event.target;
  console.log("Handler Running...");
    setMainPrompt(event.target.value); // Update state

    // Auto-resize logic:
    textarea.style.height = 'auto'; // Temporarily shrink
    console.log("Scroll Height:", textarea.scrollHeight);
    textarea.style.height = `${textarea.scrollHeight}px`; // Set to scrollHeight
};

    // --- Styles ---
    const dashboardCardStyles = { /* ... keep existing styles ... */ };
    const textAreaStyles = { /* ... keep existing styles ... */ };
    const apiKeyBoxStyles = { /* ... keep existing styles ... */ };
    const helperSectionStyles = { /* ... keep existing styles ... */ };

    // --- Load user data ---
    useEffect(() => {
        async function loadUserData() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            let { data, error } = await supabase.from('rules').select('prompt, api_key, blocked_categories, allow_list, block_list').eq('user_id', user.id).single();
            if (error && error.code !== 'PGRST116') { console.error('Error loading data:', error); /*...*/ }
            const initialCategories = {}; BLOCKED_CATEGORIES.forEach(cat => initialCategories[cat.id] = false);
            let loadedMainPrompt = '', loadedApiKey = null, loadedCategories = initialCategories, loadedAllowList = [], loadedBlockList = [];
            if (data) {
                loadedMainPrompt = data.prompt || ''; loadedApiKey = data.api_key;
                loadedCategories = data.blocked_categories || initialCategories;
                loadedAllowList = Array.isArray(data.allow_list) ? data.allow_list : [];
                loadedBlockList = Array.isArray(data.block_list) ? data.block_list : [];
                BLOCKED_CATEGORIES.forEach(cat => { if (loadedCategories[cat.id] === undefined) { loadedCategories[cat.id] = false; }});
            }
            setMainPrompt(loadedMainPrompt); setApiKey(loadedApiKey); setBlockedCategories(loadedCategories);
            setAllowListArray(loadedAllowList); setBlockListArray(loadedBlockList); setLoading(false);
        }
        loadUserData();
    }, [session]);

    // --- ADD THIS EFFECT ---
    // This effect runs *after* the component renders
    // and whenever 'mainPrompt' changes.
    useEffect(() => {
        if (mainPromptRef.current) {
            console.log("Resizing textarea on load/change...");
            const textarea = mainPromptRef.current;
            textarea.style.height = 'auto'; // Temporarily shrink
            textarea.style.height = `${textarea.scrollHeight}px`; // Set to scrollHeight
        }
    }, [mainPrompt]); // Dependency: Run this when mainPrompt changes
    // --- END OF NEW EFFECT ---

    // --- Handle checkbox changes ---
    const handleCategoryChange = (event) => {
        const { name, checked } = event.target;
        setBlockedCategories(prev => ({ ...prev, [name]: checked }));
    };

    // --- Add Domain Handler ---
    const handleAddDomain = (listType) => {
        const inputVal = (listType === 'allow' ? currentAllowInput : currentBlockInput).trim();
        if (!inputVal) return;
        let domain = null; const lowerInput = inputVal.toLowerCase();
        if (commonSiteMappings[lowerInput]) { domain = commonSiteMappings[lowerInput]; }
        else { domain = getBaseDomain(inputVal); }
        if (domain) {
            if (listType === 'allow') {
                if (!allowListArray.includes(domain)) { setAllowListArray(prev => [...prev, domain].sort()); }
                setCurrentAllowInput('');
            } else {
                if (!blockListArray.includes(domain)) { setBlockListArray(prev => [...prev, domain].sort()); }
                setCurrentBlockInput('');
            }
        } else { alert(`Could not add "${inputVal}". Invalid name or domain.`); }
    };

    // --- Remove Domain Handler ---
    const handleRemoveDomain = (listType, domainToRemove) => {
        if (listType === 'allow') { setAllowListArray(prev => prev.filter(domain => domain !== domainToRemove)); }
        else { setBlockListArray(prev => prev.filter(domain => domain !== domainToRemove)); }
    };

     // --- Handle Enter Key in Input ---
    const handleInputKeyDown = (event, listType) => {
        if (event.key === 'Enter') { event.preventDefault(); handleAddDomain(listType); }
    };

    // --- Update rule function ---
    async function updateRule(e) {
        e.preventDefault(); setLoading(true); setMessage(null);
        const { data: { user } } = await supabase.auth.getUser();
        let finalPrompt = mainPrompt.trim();
        console.log("Saving Prompt:", finalPrompt);
        console.log("Saving Lists:", { allowListArray, blockListArray });
        console.log("Saving Blocked Categories:", blockedCategories);
        
        const updates = { user_id: user.id, prompt: finalPrompt, blocked_categories: blockedCategories, allow_list: allowListArray, block_list: blockListArray };
        let { error } = await supabase.from('rules').upsert(updates, { onConflict: 'user_id' });
        if (error) { console.error("Upsert error:", error); setMessage(`Error: ${error.message}`); } else { setMessage('Rule saved!'); }
        setLoading(false);
    }

    // --- Regenerate API key function ---
    async function regenerateApiKey() {
        if (!confirm('Are you sure?')) return; setLoading(true); setMessage(null);
        const newKey = generateApiKey(); const { data: { user } } = await supabase.auth.getUser();
        const updates = { user_id: user.id, api_key: newKey };
        let { error } = await supabase.from('rules').upsert(updates, { onConflict: 'user_id' });
        if (error) { setMessage(`Error: ${error.message}`); } else { setApiKey(newKey); setMessage('New Key generated!'); }
        setLoading(false);
    }

    // --- Render Dashboard UI ---
    return (
        <div style={dashboardCardStyles}>
            <h2>Your AI Blocking Companion</h2>
            <p>Tell your AI helper your goals below. Use the optional helpers for common scenarios.</p>

            <form onSubmit={updateRule}>
                <label htmlFor="mainPrompt" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Your Main Instruction Prompt:
                </label>
                <textarea
                    id="mainPrompt" 
                    ref={mainPromptRef}
                    placeholder="e.g., I'm a student trying to focus..."
                    value={mainPrompt} onChange={handleTextAreaChange}
                />

                <div style={helperSectionStyles}>
                    <h3>Optional Helpers</h3>
                    <p>These add context to your main prompt or bypass the AI entirely.</p>

                    <fieldset style={{ border: 'none', padding: '0', margin: '1rem 0' }}>
                        <legend style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Quick Block Common Categories:</legend>
                        {BLOCKED_CATEGORIES.map((category) => (
                             <div key={category.id} className="toggle-switch-container">
                                <label className="toggle-switch">
                                    <input type="checkbox" id={`cat-${category.id}`} name={category.id}
                                        checked={blockedCategories[category.id] || false} onChange={handleCategoryChange}/>
                                    <span className="slider"></span>
                                </label>
                                <label htmlFor={`cat-${category.id}`} className="toggle-switch-label">
                                    {category.label}
                                </label>
                            </div>
                        ))}
                    </fieldset>

                    {/* --- Always Allow Section --- */}
                    <div className="tag-input-container">
                        <label htmlFor="allowInput" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            Always Allow These Websites:
                        </label>
                        <div className="tag-input-wrapper">
                            <input type="text" id="allowInput" className="tag-input-field"
                                placeholder="Type 'wikipedia' or 'example.org', then press Enter or Add"
                                value={currentAllowInput} onChange={(e) => setCurrentAllowInput(e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, 'allow')} />
                            <button type="button" className="tag-input-button" onClick={() => handleAddDomain('allow')}> Add </button>
                        </div>
                        <p className="list-helper-text">Enter common names or base domains. Pasted URLs will be cleaned.</p>
                        <div className="tag-list">
                            {allowListArray.map((domain) => (
                                <span key={domain} className="tag-item">
                                    {domain}
                                    <button type="button" className="tag-remove-button"
                                        onClick={() => handleRemoveDomain('allow', domain)} aria-label={`Remove ${domain}`}> &times; </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* --- Always Block Section --- */}
                    <div className="tag-input-container">
                        <label htmlFor="blockInput" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                            Always Block These Websites:
                        </label>
                        <div className="tag-input-wrapper">
                             <input type="text" id="blockInput" className="tag-input-field"
                                placeholder="Type 'facebook' or 'distraction.com', then press Enter or Add"
                                value={currentBlockInput} onChange={(e) => setCurrentBlockInput(e.target.value)}
                                onKeyDown={(e) => handleInputKeyDown(e, 'block')} />
                            <button type="button" className="tag-input-button" onClick={() => handleAddDomain('block')}> Add </button>
                        </div>
                         <p className="list-helper-text">Enter common names or base domains. Pasted URLs will be cleaned.</p>
                        <div className="tag-list">
                            {blockListArray.map((domain) => (
                                <span key={domain} className="tag-item">
                                    {domain}
                                    <button type="button" className="tag-remove-button"
                                        onClick={() => handleRemoveDomain('block', domain)} aria-label={`Remove ${domain}`}> &times; </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- Save Button & Message --- */}
                 <div style={{ marginTop: '2rem', display: 'flex', alignItems: 'center' }}>
                    <button type="submit" disabled={loading}>
                        {loading ? 'Saving...' : 'Save Rule'}
                    </button>
                    {message && (
                        <span style={{ marginLeft: '1rem', color: message.startsWith('Error') ? 'red' : 'green' }}>
                            {message}
                        </span>
                    )}
                 </div>
            </form>

            {/* --- API Key Section --- */}
            <hr style={{ margin: '2rem 0' }} />
            <h2>Your API Key</h2>
            <p>Copy this key and paste it into your Chrome extension's settings.</p>
            <div style={apiKeyBoxStyles}>
                {apiKey ? apiKey : "No key generated yet. Click below."}
            </div>
            <button style={{marginTop: '1rem'}} onClick={regenerateApiKey} disabled={loading}>
                {loading ? '...' : (apiKey ? 'Regenerate API Key' : 'Generate API Key')}
            </button>

            {/* --- How To Section --- */}
            <hr style={{ margin: '2rem 0' }} />
            <h2>How to Install & Activate</h2>
            <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                <li><strong>Step 1: Get the Extension</strong><br />(Link/Instructions to get the extension folder)</li>
                <li style={{ marginTop: '1rem' }}><strong>Step 2: Install in Chrome</strong><br />Go to <code>chrome://extensions</code>, turn on Developer mode, click "Load unpacked", select extension folder.</li>
                <li style={{ marginTop: '1rem' }}><strong>Step 3: Activate</strong><br />Click extension icon, paste API Key, click Save.</li>
            </ol>

            {/* --- Sign Out Button --- */}
            <button style={{marginTop: '2rem', display: 'block'}} onClick={() => supabase.auth.signOut()}>
                Sign Out
            </button>
        </div>
    );
}

// === Main App Component (Handles Auth State) ===
export default function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            setSession(initialSession); setLoading(false);
        }).catch(error => { console.error("Error getting initial session:", error); setLoading(false); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
            setSession(updatedSession); setLoading(false);
        });
        return () => { subscription?.unsubscribe(); };
    }, []);

    if (loading) {
        return (<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>);
    }

    return (
        <div className="container" style={{ padding: '50px 0 100px 0' }}>
            {!session ? (
                <div style={{maxWidth: '400px', margin: 'auto'}}>
                    <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
                </div>
            ) : (
                <Dashboard key={session.user.id} session={session} />
            )}
        </div>
    );
}