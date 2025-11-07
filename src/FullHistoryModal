import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const LOGS_PER_PAGE = 50; // Number of logs to fetch at a time

// This component fetches and manages its own data
export default function FullHistoryModal({ isOpen, onClose, session }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [totalLogs, setTotalLogs] = useState(0);

    // Fetch the total count of logs once when the modal is opened
    useEffect(() => {
        if (isOpen && session?.user) {
            async function fetchTotalCount() {
                const { count, error } = await supabase
                    .from('blocking_log')
                    .select('id', { count: 'exact', head: true }) // Only fetch the count
                    .eq('user_id', session.user.id);
                
                if (error) {
                    console.error("Error fetching log count:", error);
                } else {
                    setTotalLogs(count || 0);
                }
            }
            fetchTotalCount();
        }
    }, [isOpen, session]);

    // Fetch a specific page of logs when the page or open state changes
    useEffect(() => {
        if (isOpen && session?.user) {
            async function fetchHistoryPage() {
                setLoading(true);
                const from = currentPage * LOGS_PER_PAGE;
                const to = from + LOGS_PER_PAGE - 1;

                const { data, error } = await supabase
                    .from('blocking_log')
                    .select('*')
                    .eq('user_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .range(from, to); // This is how Supabase does pagination

                if (error) {
                    console.error("Error fetching log page:", error);
                } else {
                    setLogs(data || []);
                }
                setLoading(false);
            }
            fetchHistoryPage();
        }
    }, [isOpen, session, currentPage]);

    // Don't render anything if the modal is closed
    if (!isOpen) {
        return null; 
    }

    const totalPages = Math.ceil(totalLogs / LOGS_PER_PAGE);
    const canGoPrev = currentPage > 0;
    const canGoNext = (currentPage + 1) * LOGS_PER_PAGE < totalLogs;

    return (
        <div className="modal-overlay" onClick={onClose}>
            {/* Clicks on modal-content are stopped from closing it */}
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Full Blocking History</h2>
                    <button className="modal-close-button" onClick={onClose}>&times;</button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <p>Loading history...</p>
                    ) : (
                        <>
                            <ul className="log-feed-list full-history-list">
                                {logs.length === 0 ? (
                                    <p>No history found.</p>
                                ) : (
                                    logs.map(log => (
                                        // We can reuse the same log-item styles
                                        <li key={log.id} className={`log-item log-item-${log.decision.toLowerCase()}`}>
                                            <span className="log-decision">{log.decision}</span>
                                            <span className="log-url" title={log.url}>{log.page_title || log.domain || 'Unknown Page'}</span>
                                            <span className="log-reason">({log.reason})</span>
                                            <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                                        </li>
                                    ))
                                )}
                            </ul>
                            <div className="pagination-controls">
                                <button onClick={() => setCurrentPage(p => p - 1)} disabled={!canGoPrev}>
                                    &larr; Previous
                                </button>
                                <span>
                                    Page {currentPage + 1} of {totalPages || 1}
                                </span>
                                <button onClick={() => setCurrentPage(p => p + 1)} disabled={!canGoNext}>
                                    Next &rarr;
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}