import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient.js'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
// CSS is in main.jsx

// --- (generateApiKey function is unchanged) ---
function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// This is the component for your dashboard
function Dashboard({ session }) {
  const [loading, setLoading] = useState(true)
  const [prompt, setPrompt] = useState(null)
  const [apiKey, setApiKey] = useState(null)
  const [message, setMessage] = useState(null)

  // --- (Styles are unchanged) ---
  const dashboardCardStyles = {
    maxWidth: '800px', margin: '2rem auto', padding: '2rem',
    backgroundColor: '#ffffff', color: '#000000', borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
  }
  const textAreaStyles = {
    width: '100%', boxSizing: 'border-box', height: '200px',
    fontFamily: 'monospace', padding: '10px', border: '1px solid #ccc',
    borderRadius: '4px', backgroundColor: '#f9f9f9', color: '#000000'
  }
  const apiKeyBoxStyles = {
    fontFamily: 'monospace',
    backgroundColor: '#eee',
    color: '#333',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    wordBreak: 'break-all'
  }

  // --- (useEffect for getRuleAndKey is unchanged) ---
  useEffect(() => {
    async function getRuleAndKey() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      let { data, error } = await supabase
        .from('rules')
        .select('prompt, api_key')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.warn('No rule found, creating a new one.', error)
      }
      if (data) {
        setPrompt(data.prompt)
        setApiKey(data.api_key)
      }
      setLoading(false)
    }
    getRuleAndKey()
  }, [session])

  // --- (updateRule function is unchanged) ---
  async function updateRule(e) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { data: { user } } = await supabase.auth.getUser()
    const updates = {
      user_id: user.id,
      prompt: prompt,
    }
    let { error } = await supabase.from('rules').upsert(updates, {
      onConflict: 'user_id' 
    })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Rule saved successfully!')
    }
    setLoading(false)
  }

  // --- (regenerateApiKey function is unchanged) ---
  async function regenerateApiKey() {
    if (!confirm('Are you sure? This will break your old key.')) {
      return
    }
    setLoading(true)
    setMessage(null)
    const newKey = generateApiKey()
    const { data: { user } } = await supabase.auth.getUser()
    const updates = {
      user_id: user.id,
      api_key: newKey
    }
    let { error } = await supabase.from('rules').upsert(updates, {
      onConflict: 'user_id' 
    })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setApiKey(newKey)
      setMessage('New API Key generated successfully!')
    }
    setLoading(false)
  }

  return (
    <div style={dashboardCardStyles}> 
      <h2>Set Your AI Blocking Rule</h2>
      <p>This is the prompt your AI will use to block websites.</p>
      <form onSubmit={updateRule}>
        <textarea
          style={textAreaStyles}
          value={prompt || ''}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center' }}>
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
      
      <hr style={{ margin: '2rem 0' }} />
      <h2>Your API Key</h2>
      <p>Copy this key. You will need it to activate your extension in Step 3.</p>
      <div style={apiKeyBoxStyles}>
        {apiKey ? apiKey : "No key generated yet. Click the button below."}
      </div>
      <button style={{marginTop: '1rem'}} onClick={regenerateApiKey} disabled={loading}>
        {loading ? '...' : (apiKey ? 'Regenerate API Key' : 'Generate API Key')}
      </button>
      
      {/* --- NEW SECTION: THE GUIDE --- */}
      <hr style={{ margin: '2rem 0' }} />
      <h2>How to Install & Activate</h2>
      <ol style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
        <li>
          <strong>Step 1: Get the Extension</strong><br />
          (For now, this just means having your <code>ai-blocker-extension</code> folder ready. Later, this will be a download link.)
        </li>
        <li style={{ marginTop: '1rem' }}>
          <strong>Step 2: Install in Chrome</strong><br />
          In your Chrome browser, go to <code>chrome://extensions</code>. Turn on "Developer mode" in the top-right corner. Click "Load unpacked" and select your <code>ai-blocker-extension</code> folder.
        </li>
        <li style={{ marginTop: '1rem' }}>
          <strong>Step 3: Activate</strong><br />
          The extension icon will appear in your toolbar. Click it, paste in your API Key from above, and hit Save. (We'll build this settings page next!)
        </li>
      </ol>
      {/* --- END NEW SECTION --- */}
      
      <button style={{marginTop: '2rem', display: 'block'}} onClick={() => supabase.auth.signOut()}>
        Sign Out
      </button>
    </div>
  )
}

// ... (Your main App() component below this line stays exactly the same) ...
export default function App() {
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
  }, [])

  return (
    <div className="container" style={{ padding: '50px 0 100px 0' }}>
      {!session ? (
        <div style={{maxWidth: '400px', margin: 'auto'}}>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={[]}
          />
        </div>
      ) : (
        <Dashboard key={session.user.id} session={session} />
      )}
    </div>
  )
}