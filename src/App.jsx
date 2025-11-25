import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import FullHistoryModal from './FullHistoryModal.jsx'; // Import for history modal
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
    { id: 'shorts', label: 'Shorts / Reels / TikTok (Continuous Scroll)' },
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
    const [logs, setLogs] = useState([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const mainPromptRef = useRef(null);

    // --- Auto-Resize Handler for Main Prompt ---
    const handleTextAreaChange = (event) => {
        const textarea = event.target;
        setMainPrompt(event.target.value);
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    };

    // --- Styles ---
    const dashboardCardStyles = { /* ... */ };
    const apiKeyBoxStyles = { /* ... */ };
    const helperSectionStyles = { /* ... */ };

    // --- Load user data ---
    useEffect(() => {
        async function loadUserData() {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            let { data, error } = await supabase.from('rules').select('prompt, api_key, blocked_categories, allow_list, block_list').eq('user_id', user.id).single();

            if (error && error.code !== 'PGRST116') { console.error('Error loading data:', error); }
            const initialCategories = {}; BLOCKED_CATEGORIES.forEach(cat => initialCategories[cat.id] = false);
            let loadedMainPrompt = '', loadedApiKey = null, loadedCategories = initialCategories, loadedAllowList = [], loadedBlockList = [];

            if (data) {
                loadedMainPrompt = data.prompt || '';
                loadedApiKey = data.api_key;
                loadedCategories = data.blocked_categories || initialCategories;
                loadedAllowList = Array.isArray(data.allow_list) ? data.allow_list : [];
                loadedBlockList = Array.isArray(data.block_list) ? data.block_list : [];
                BLOCKED_CATEGORIES.forEach(cat => { if (loadedCategories[cat.id] === undefined) { loadedCategories[cat.id] = false; } });
            }

            setMainPrompt(loadedMainPrompt); setApiKey(loadedApiKey); setBlockedCategories(loadedCategories);
            setAllowListArray(loadedAllowList); setBlockListArray(loadedBlockList); setLoading(false);
        }
        loadUserData();
    }, [session]);

    // --- Auto-resize text area on load ---
    useEffect(() => {
        if (mainPromptRef.current) {
            const textarea = mainPromptRef.current;
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [mainPrompt]);

    // --- Load user logs AND subscribe to new ones ---
    useEffect(() => {
        const currentUserId = session?.user?.id;
        if (!currentUserId) return;

        async function fetchLogs() {
            let { data: logData, error } = await supabase
                .from('blocking_log')
                .select('*')
                .eq('user_id', currentUserId)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error("Error fetching initial logs:", error);
            } else {
                const filteredLogs = (logData || []).filter(log => log.reason !== 'System Rule (Infra)');
                setLogs(filteredLogs);
            }
        }

        fetchLogs();

        const logChannel = supabase
            .channel(`public:blocking_log:user_id=eq.${currentUserId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'blocking_log',
                    filter: `user_id=eq.${currentUserId}`
                },
                (payload) => {
                    console.log('New log received!', payload.new);
                    if (payload.new.reason !== 'System Rule (Infra)') {
                        setLogs(prevLogs => [payload.new, ...prevLogs]);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(logChannel);
        };

    }, [session]);



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




            <h2>Beacon Blocker Rules</h2>
            <p>Set your blocking rules below. Use the optional helpers for common scenarios.</p>

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
                                        checked={blockedCategories[category.id] || false} onChange={handleCategoryChange} />
                                    <span className="slider"></span>
                                </label>
                                <label htmlFor={`cat-${category.id}`} className="toggle-switch-label">
                                    {category.label}
                                </label>
                            </div>
                        ))}
                    </fieldset>

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

            {/* --- LOG FEED SECTION --- */}
            <hr style={{ margin: '2rem 0' }} />
            <h2>Recent Activity</h2>
            <div className="log-feed-container">
                {logs.length === 0 ? (
                    <p>No blocking activity recorded yet.</p>
                ) : (
                    <ul className="log-feed-list">
                        {logs.map(log => (
                            <li key={log.id} className={`log-item log-item-${log.decision.toLowerCase()}`}>
                                <span className="log-decision">{log.decision}</span>
                                <span className="log-url" title={log.url}>{log.page_title || log.domain || 'Unknown Page'}</span>
                                <span className="log-reason">({log.reason})</span>
                                <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <button type="button" className="view-history-button" onClick={() => setIsHistoryModalOpen(true)}>
                View Full History
            </button>
            {/* --- END LOG FEED SECTION --- */}

            {/* --- API Key Section --- */}
            <hr style={{ margin: '2rem 0' }} />
            <h2>Your API Key</h2>
            <p>Copy this key and paste it into your Chrome extension's settings.</p>
            <div style={apiKeyBoxStyles}>
                {apiKey ? apiKey : "No key generated yet. Click below."}
            </div>
            <button style={{ marginTop: '1rem' }} onClick={regenerateApiKey} disabled={loading}>
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
            <button style={{ marginTop: '2rem', display: 'block' }} onClick={() => supabase.auth.signOut()}>
                Sign Out
            </button>

            {/* --- RENDER THE MODAL --- */}
            <FullHistoryModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                session={session}
            />
        </div>
    );
}

// === Password Reset Component ===
function PasswordResetForm({ onSuccess }) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setLoading(true); setMessage(null);
        if (password.length < 6) {
            setMessage("Password must be at least 6 characters.");
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.updateUser({ password: password });

        if (error) {
            setMessage(`Error: ${error.message}`);
        } else {
            setMessage("Password updated successfully! Redirecting...");
            setTimeout(() => {
                onSuccess();
            }, 1500);
        }
        setLoading(false);
    };

    return (
        <div className="container" style={{ padding: '50px 0', maxWidth: '400px', margin: 'auto' }}>
            <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
                <h2 style={{ textAlign: 'center', color: '#2563eb', marginBottom: '1rem' }}>Set New Password</h2>
                <form onSubmit={handlePasswordUpdate}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>New Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        required
                    />
                    <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.75rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        {loading ? 'Updating...' : 'Update Password'}
                    </button>
                    {message && <p style={{ marginTop: '1rem', textAlign: 'center', color: message.startsWith('Error') ? 'red' : 'green' }}>{message}</p>}
                </form>
            </div>
        </div>
    );
}

// === Custom Auth Component ===
function AuthForm({ supabase }) {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (isLogin) {
            // Login Logic
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) setMessage(error.message);
        } else {
            // Sign Up Logic
            if (password.length < 6) {
                setMessage("Password must be at least 6 characters.");
                setLoading(false);
                return;
            }
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) {
                setMessage(error.message);
            } else {
                setMessage("Account created! You are now logged in.");
            }
        }
        setLoading(false);
    };

    const handleGoogleLogin = async () => {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
        });
        if (error) setMessage(error.message);
    };

    const handleForgotPassword = async () => {
        if (!email) {
            setMessage("Please enter your email address first.");
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        if (error) setMessage(error.message);
        else setMessage("Password reset link sent to your email!");
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className={`auth-card ${isLogin ? 'mode-login' : 'mode-signup'}`}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src="/logo.jpg" alt="Beacon Blocker Logo" style={{ width: '80px', height: '80px', marginBottom: '1rem', borderRadius: '50%' }} />
                    <h1 style={{ margin: 0, color: isLogin ? 'var(--primary-blue)' : 'var(--primary-red)' }}>
                        Beacon Blocker
                    </h1>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        {isLogin ? 'Sign in to manage your rules' : 'Create an account to get started'}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    style={{
                        width: '100%',
                        padding: '0.75rem',
                        marginBottom: '1.5rem',
                        backgroundColor: 'white',
                        color: '#333',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '1rem'
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" fillRule="evenodd" />
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.715H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" fillRule="evenodd" />
                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" fillRule="evenodd" />
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.272C4.672 5.14 6.656 3.58 9 3.58z" fill="#EA4335" fillRule="evenodd" />
                    </svg>
                    Sign in with Google
                </button>

                <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: '#94a3b8', fontSize: '0.875rem' }}>
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0' }}></div>
                    <span style={{ margin: '0 0.5rem' }}>OR</span>
                    <div style={{ flex: 1, borderBottom: '1px solid #e2e8f0' }}></div>
                </div>

                <form onSubmit={handleAuth}>
                    <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input
                            type="email"
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-input"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                style={{ paddingRight: '80px' }}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '5px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: '#64748b',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    width: 'auto',
                                    padding: '5px'
                                }}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    {message && (
                        <div style={{
                            padding: '0.75rem',
                            borderRadius: '8px',
                            marginBottom: '1rem',
                            backgroundColor: message.includes('sent') || message.includes('created') ? '#dcfce7' : '#fee2e2',
                            color: message.includes('sent') || message.includes('created') ? '#166534' : '#991b1b',
                            fontSize: '0.875rem'
                        }}>
                            {message}
                        </div>
                    )}

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Log In' : 'Sign Up')}
                    </button>
                </form>

                <div className="auth-toggle">
                    {isLogin ? (
                        <>
                            <p>
                                <span className="auth-link" onClick={handleForgotPassword}>Forgot Password?</span>
                            </p>
                            <p>
                                Don't have an account?{' '}
                                <span className="auth-link" onClick={() => { setIsLogin(false); setMessage(null); }}>
                                    Sign Up
                                </span>
                            </p>
                        </>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <span className="auth-link" onClick={() => { setIsLogin(true); setMessage(null); }}>
                                Log In
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

// === Main App Component (Handles Auth State) ===
export default function App() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recoveryMode, setRecoveryMode] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            setSession(initialSession); setLoading(false);
        }).catch(error => { console.error("Error getting initial session:", error); setLoading(false); });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, updatedSession) => {
            if (event === 'PASSWORD_RECOVERY') {
                setRecoveryMode(true);
            }
            setSession(updatedSession); setLoading(false);
        });
        return () => { subscription?.unsubscribe(); };
    }, []);

    if (loading) {
        return (<div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading...</div>);
    }

    if (recoveryMode) {
        return <PasswordResetForm onSuccess={() => setRecoveryMode(false)} />;
    }

    return (
        <>
            {!session ? (
                <AuthForm supabase={supabase} />
            ) : (
                <div className="container">
                    <Dashboard key={session.user.id} session={session} />
                </div>
            )}
        </>
    );
}