import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { theme } from '../styles/theme';
import { getBasePath } from '../utils/basePath';
import { useApi } from '../api';

const MERGE_FIELDS = [
  { token: '{{clientName}}', label: 'Client name' },
  { token: '{{eventTypeName}}', label: 'Event name' },
  { token: '{{startTime}}', label: 'Event time' },
  { token: '{{startDate}}', label: 'Event date' },
  { token: '{{durationMinutes}}', label: 'Duration' },
  { token: '{{professionalName}}', label: 'Coach / Instructor name' },
  { token: '{{professionalEmail}}', label: 'Instructor email' },
  { token: '{{professionalPhone}}', label: 'Instructor phone' },
  { token: '{{location}}', label: 'Location' },
  { token: '{{addToCalendarLink}}', label: 'Add to calendar link' },
  { token: '{{manageLink}}', label: 'Manage booking link' },
];

export default function NotificationTemplatePage() {
  const { eventTypeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const basePath = getBasePath(location.pathname);
  const { apiFetch } = useApi();

  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventType, setSelectedEventType] = useState(null);
  const [templateHtml, setTemplateHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const editorRef = useRef(null);

  useEffect(() => {
    apiFetch('/event-types')
      .then((r) => r.json())
      .then(setEventTypes)
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    if (!eventTypeId || !eventTypes.length) {
      setSelectedEventType(null);
      setTemplateHtml('');
      return;
    }
    const id = Number(eventTypeId);
    const fromList = eventTypes.find((et) => et.id === id);
    if (fromList && fromList.notificationTemplate !== undefined) {
      setSelectedEventType(fromList);
      setTemplateHtml(fromList.notificationTemplate || '');
      return;
    }
    setSelectedEventType(null);
    setTemplateHtml('');
    apiFetch(`/event-types/id/${eventTypeId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found'))))
      .then((et) => {
        setSelectedEventType(et);
        setTemplateHtml(et.notificationTemplate || '');
      })
      .catch(() => setMessage({ type: 'error', text: 'Event type not found' }));
  }, [eventTypeId, eventTypes, apiFetch]);

  // Sync editor content when template loads (e.g. switching event type). Use templateHtml from state at that moment (already updated by load effect).
  useEffect(() => {
    if (editorRef.current && selectedEventType != null) {
      editorRef.current.innerHTML = templateHtml || '';
    }
  }, [eventTypeId, selectedEventType?.id]);

  const syncEditorToState = () => {
    if (editorRef.current) setTemplateHtml(editorRef.current.innerHTML || '');
  };

  const insertMergeField = (token) => {
    const el = editorRef.current;
    if (!el) {
      setTemplateHtml((prev) => prev + token);
      return;
    }
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    if (sel.rangeCount) {
      range.setStart(sel.anchorNode, sel.anchorOffset);
      range.collapse(true);
    } else {
      range.selectNodeContents(el);
      range.collapse(true);
    }
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('insertText', false, token);
    syncEditorToState();
  };

  const applyFormat = (command, value = null) => {
    const el = editorRef.current;
    if (el) {
      el.focus();
      document.execCommand(command, false, value);
      syncEditorToState();
    }
  };

  const handleSave = () => {
    if (!selectedEventType?.id) return;
    setSaving(true);
    setMessage(null);
    apiFetch(`/event-types/${selectedEventType.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ notificationTemplate: templateHtml || null }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d.error || 'Failed')))))
      .then((updated) => {
        setSelectedEventType(updated);
        setMessage({ type: 'success', text: 'Template saved.' });
      })
      .catch((e) => setMessage({ type: 'error', text: e.message || 'Save failed' }))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={styles.muted}>Loading…</p>
      </div>
    );
  }

  if (eventTypes.length === 0) {
    return (
      <div style={styles.page}>
        <h1 style={styles.title}>Notification template</h1>
        <div style={styles.card}>
          <p style={styles.muted}>Create an event type first from Scheduling to add a notification template.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Notification template</h1>
      <div style={styles.layout}>
        <aside style={styles.menu}>
          <span style={styles.menuLabel}>Event types</span>
          {eventTypes.map((et) => (
            <button
              key={et.id}
              type="button"
              style={{
                ...styles.menuItem,
                ...(Number(eventTypeId) === et.id ? styles.menuItemActive : {}),
              }}
              onClick={() => navigate(`${basePath}/notification-template/${et.id}`)}
            >
              {et.name || et.slug || `Event #${et.id}`}
            </button>
          ))}
        </aside>
        <div style={styles.main}>
          {!eventTypeId ? (
            <div style={styles.card}>
              <p style={styles.muted}>Select an event type to edit its confirmation email template.</p>
            </div>
          ) : (
            <>
              <div style={styles.card}>
                <div style={styles.mergeRow}>
                  <span style={styles.mergeLabel}>Insert:</span>
                  <div style={styles.mergeButtons}>
                    {MERGE_FIELDS.map(({ token, label }) => (
                      <button
                        key={token}
                        type="button"
                        style={styles.mergeBtn}
                        onClick={() => insertMergeField(token)}
                        title={label}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={styles.formatRow}>
                  <button type="button" style={styles.formatBtn} onClick={() => applyFormat('bold')} title="Bold">
                    <b>B</b>
                  </button>
                  <button type="button" style={styles.formatBtn} onClick={() => applyFormat('italic')} title="Italic">
                    <i>I</i>
                  </button>
                  <button type="button" style={styles.formatBtn} onClick={() => applyFormat('underline')} title="Underline">
                    <u>U</u>
                  </button>
                </div>
                <div style={styles.editorWrap}>
                  <div
                    ref={editorRef}
                    className="notification-template-editor"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-label="Email template body"
                    style={styles.editor}
                    onInput={syncEditorToState}
                    data-placeholder="Write your confirmation email body. Use the buttons above to insert placeholders."
                  />
                </div>
                {message && (
                  <p style={message.type === 'error' ? styles.messageError : styles.messageSuccess}>
                    {message.text}
                  </p>
                )}
                <div style={styles.saveRow}>
                  <button type="button" style={styles.saveBtn} onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save template'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 960,
  },
  title: {
    fontSize: theme.fontSize.title,
    fontWeight: 700,
    color: theme.text,
    marginBottom: theme.spacing[20],
  },
  layout: {
    display: 'flex',
    gap: theme.spacing[24],
    alignItems: 'flex-start',
  },
  menu: {
    flexShrink: 0,
    width: 220,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing[4],
  },
  menuLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: 600,
    color: theme.muted,
    marginBottom: theme.spacing[4],
  },
  menuItem: {
    display: 'block',
    width: '100%',
    padding: `${theme.spacing[10]}px ${theme.spacing[12]}px`,
    textAlign: 'left',
    fontSize: theme.fontSize.base,
    color: theme.text,
    background: 'transparent',
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    transition: theme.transition,
  },
  menuItemActive: {
    background: theme.navActiveBg,
    borderColor: theme.primary,
    color: theme.primary,
    fontWeight: 500,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  card: {
    background: theme.cardBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadiusLg,
    padding: theme.spacing[24],
    boxShadow: theme.shadowCard,
  },
  mergeRow: {
    marginBottom: theme.spacing[16],
  },
  mergeLabel: {
    display: 'block',
    fontSize: theme.fontSize.sm,
    fontWeight: 600,
    color: theme.muted,
    marginBottom: theme.spacing[8],
  },
  mergeButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing[8],
  },
  mergeBtn: {
    padding: `${theme.spacing[6]}px ${theme.spacing[10]}px`,
    fontSize: theme.fontSize.sm,
    background: theme.secondaryBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    transition: theme.transition,
  },
  formatRow: {
    display: 'flex',
    gap: theme.spacing[4],
    marginBottom: theme.spacing[12],
  },
  formatBtn: {
    padding: `${theme.spacing[6]}px ${theme.spacing[10]}px`,
    fontSize: theme.fontSize.base,
    background: theme.secondaryBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    transition: theme.transition,
  },
  editorWrap: {
    marginBottom: theme.spacing[16],
  },
  editor: {
    minHeight: 220,
    padding: theme.spacing[12],
    border: `1px solid ${theme.border}`,
    borderRadius: theme.borderRadius,
    fontSize: theme.fontSize.base,
    fontFamily: 'inherit',
    outline: 'none',
  },
  messageError: {
    color: '#b91c1c',
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing[12],
  },
  messageSuccess: {
    color: '#059669',
    fontSize: theme.fontSize.sm,
    marginBottom: theme.spacing[12],
  },
  saveRow: {
    marginTop: theme.spacing[16],
  },
  saveBtn: {
    padding: `${theme.spacing[10]}px ${theme.spacing[20]}px`,
    fontSize: theme.fontSize.base,
    fontWeight: 600,
    background: theme.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius,
    cursor: 'pointer',
    transition: theme.transition,
  },
  muted: {
    color: theme.muted,
    fontSize: theme.fontSize.base,
  },
};
