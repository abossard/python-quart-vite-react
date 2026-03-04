/**
 * KBA Drafter Page - Vollständiger UI-Flow
 * 
 * 1. Eingabefeld für Ticketnummer + Button "Entwurf erstellen"
 * 2. Ladezustand / Fehleranzeige
 * 3. Anzeige des generierten KBA-Entwurfs in strukturierter Form
 * 4. Editiermodus mit Toggle für manuelle Prüfung
 * 5. "Speichern" Button (mit Pending Changes Tracking)
 * 6. "In Knowledge Base übernehmen" (Publish)
 * 7. Bestätigung / Erfolgsmeldung / Fehlermeldung
 */

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardHeader,
  Button,
  Input,
  Textarea,
  Label,
  Text,
  makeStyles,
  Spinner,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  tokens,
  Badge,
  Tag,
  TagGroup,
  Field,
} from "@fluentui/react-components";
import {
  DocumentText24Regular,
  Send24Regular,
  Save24Regular,
  Checkmark24Regular,
  Dismiss24Regular,
  Edit24Regular,
  Eye24Regular,
  Warning24Regular,
  Delete24Regular,
  Dismiss20Regular,
} from "@fluentui/react-icons";
import * as api from "../../services/api";
import EditableList from "./components/EditableList";
import TagEditor from "./components/TagEditor";
import DuplicateKBADialog from "./components/DuplicateKBADialog";
import ConfirmDialog from "./components/ConfirmDialog";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXL,
    padding: tokens.spacingVerticalXL,
    maxWidth: "1400px",
    margin: "0 auto",
  },
  inputSection: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    alignItems: "flex-end",
  },
  draftCard: {
    marginBottom: tokens.spacingVerticalM,
  },
  draftHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  draftContent: {
    padding: tokens.spacingVerticalL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  solutionSteps: {
    listStyle: "decimal",
    paddingLeft: tokens.spacingHorizontalXL,
    overflowWrap: "break-word",
    wordBreak: "break-word",
    "& li": {
      marginBottom: tokens.spacingVerticalS,
      overflowWrap: "break-word",
      wordBreak: "break-word",
    },
  },
  actions: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  statusBadge: {
    marginLeft: tokens.spacingHorizontalS,
  },
  pendingIndicator: {
    color: tokens.colorPaletteYellowForeground1,
    fontWeight: "bold",
  },
  loadingOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  loadingContent: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingVerticalXXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow64,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalL,
  },
});

export default function KBADrafterPage() {
  const styles = useStyles();
  
  // State Management
  const [ticketId, setTicketId] = useState("");
  const [ticketIdError, setTicketIdError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [editedDraft, setEditedDraft] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [message, setMessage] = useState(null);
  const [llmAvailable, setLlmAvailable] = useState(null);
  const [editMode, setEditMode] = useState(false);
  
  // Duplicate dialog state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [existingDrafts, setExistingDrafts] = useState([]);
  const [pendingTicketId, setPendingTicketId] = useState(null);
  
  // Confirm dialog states
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [draftToDelete, setDraftToDelete] = useState(null);

  // Helper: Check for pending changes
  const hasPendingChanges = editedDraft && JSON.stringify(editedDraft) !== JSON.stringify(currentDraft);

  // Helper: Get badge color based on status
  const getStatusBadgeColor = (status) => {
    switch (status?.toLowerCase()) {
      case "published":
        return "success";
      case "reviewed":
        return "informative";
      case "draft":
        return "warning";
      default:
        return "subtle";
    }
  };

  // Ticket ID validation - supports UUID or Incident-ID format
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const INCIDENT_ID_REGEX = /^INC\d{12}$/;

  const validateTicketId = (value) => {
    if (!value.trim()) {
      setTicketIdError("Ticketnummer ist erforderlich");
      return false;
    }
    const trimmed = value.trim();
    if (!UUID_REGEX.test(trimmed) && !INCIDENT_ID_REGEX.test(trimmed)) {
      setTicketIdError("Ungültiges Format. Verwenden Sie UUID (550e8400-...) oder Incident-ID (INC000016349815)");
      return false;
    }
    setTicketIdError("");
    return true;
  };

  // Check LLM health on mount
  useEffect(() => {
    api.checkKBAHealth()
      .then((status) => setLlmAvailable(status.llm_available))
      .catch(() => setLlmAvailable(false));
    
    loadDrafts();
  }, []);

  const loadDrafts = useCallback(async () => {
    try {
      const response = await api.listKBADrafts({ limit: 10 });
      setDrafts(response.items || []);
    } catch (error) {
      console.error("Failed to load drafts:", error);
    }
  }, []);

  // Handler: Generate KBA Draft from Ticket
  const handleGenerate = async (forceCreate = false) => {
    if (!validateTicketId(ticketId)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const draft = await api.generateKBADraft({
        ticket_id: ticketId.trim(),
        user_id: "user@example.com", // TODO: Get from auth context
        force_create: forceCreate,
      });
      
      setCurrentDraft(draft);
      setEditedDraft(JSON.parse(JSON.stringify(draft))); // Deep copy
      setEditMode(false);
      setMessage({
        type: "success",
        text: `✓ KBA-Entwurf erfolgreich erstellt in ${draft.llm_generation_time_ms}ms`,
      });
      setTicketId("");
      setTicketIdError("");
      loadDrafts();
    } catch (error) {
      // Handle duplicate draft error (409)
      if (error.status === 409 && error.data?.existing_drafts) {
        // Show dialog with existing drafts
        setExistingDrafts(error.data.existing_drafts);
        setPendingTicketId(ticketId.trim());
        setDuplicateDialogOpen(true);
        setLoading(false);
        return;
      }
      
      setMessage({
        type: "error",
        text: error.message || "Fehler beim Generieren des KBA",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handler: View existing draft from duplicate dialog
  const handleViewExisting = async (draftId) => {
    setDuplicateDialogOpen(false);
    setLoading(true);
    try {
      const draft = await api.getKBADraft(draftId);
      setCurrentDraft(draft);
      setEditedDraft(JSON.parse(JSON.stringify(draft)));
      setEditMode(false);
      setMessage({
        type: "success",
        text: "Bestehender KBA-Entwurf geladen",
      });
      setTicketId("");
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Fehler beim Laden des Entwurfs",
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Handler: Force create new draft (from duplicate dialog)
  const handleForceCreate = () => {
    setDuplicateDialogOpen(false);
    handleGenerate(true);
  };
  
  // Handler: Cancel duplicate dialog
  const handleCancelDuplicate = () => {
    setDuplicateDialogOpen(false);
    setExistingDrafts([]);
    setPendingTicketId(null);
  };
  
  // Handler: Replace/Regenerate draft
  const handleReplace = async () => {
    if (!currentDraft) return;
    setReplaceDialogOpen(true);
  };
  
  const confirmReplace = async () => {
    setReplaceDialogOpen(false);
    if (!currentDraft) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      const replacedDraft = await api.replaceKBADraft(
        currentDraft.id,
        "user@example.com" // TODO: Get from auth context
      );
      
      setCurrentDraft(replacedDraft);
      setEditedDraft(JSON.parse(JSON.stringify(replacedDraft)));
      setEditMode(false);
      setMessage({
        type: "success",
        text: `✓ KBA-Entwurf erfolgreich ersetzt`,
      });
      loadDrafts();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Fehler beim Ersetzen des Entwurfs",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Field Change (Edit Mode)
  const handleFieldChange = (field, value) => {
    if (!editMode || !editedDraft) return;
    
    setEditedDraft({
      ...editedDraft,
      [field]: value,
    });
  };

  // Handler: Save Changes
  const handleSave = async () => {
    if (!currentDraft || !hasPendingChanges) return;

    setSaving(true);
    setMessage(null);

    try {
      // Build update object with only changed fields
      const updates = {};
      Object.keys(editedDraft).forEach(key => {
        if (JSON.stringify(editedDraft[key]) !== JSON.stringify(currentDraft[key])) {
          updates[key] = editedDraft[key];
        }
      });

      const updated = await api.updateKBADraft(
        currentDraft.id,
        updates,
        "user@example.com"
      );
      
      setCurrentDraft(updated);
      setEditedDraft(JSON.parse(JSON.stringify(updated)));
      setMessage({ type: "success", text: "✓ Änderungen gespeichert" });
    } catch (error) {
      setMessage({ type: "error", text: "✗ Fehler beim Speichern: " + error.message });
    } finally {
      setSaving(false);
    }
  };

  // Handler: Toggle Edit Mode
  const toggleEditMode = () => {
    if (editMode && hasPendingChanges) {
      if (window.confirm("Nicht gespeicherte Änderungen verwerfen?")) {
        setEditedDraft(JSON.parse(JSON.stringify(currentDraft)));
        setEditMode(false);
      }
    } else {
      setEditMode(!editMode);
      if (!editMode) {
        setEditedDraft(JSON.parse(JSON.stringify(currentDraft)));
      }
    }
  };

  // Handler: Mark as Reviewed
  const handleReview = async () => {
    if (!currentDraft) return;

    if (hasPendingChanges) {
      setMessage({ type: "error", text: "Bitte erst Änderungen speichern" });
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateKBADraft(
        currentDraft.id,
        { status: "reviewed", reviewed_by: "user@example.com" },
        "user@example.com"
      );
      setCurrentDraft(updated);
      setEditedDraft(JSON.parse(JSON.stringify(updated)));
      setEditMode(false);
      setMessage({ type: "success", text: "✓ Als geprüft markiert" });
    } catch (error) {
      setMessage({ type: "error", text: "Fehler beim Status-Update" });
    } finally {
      setSaving(false);
    }
  };

  // Handler: Publish to Knowledge Base
  const handlePublish = async () => {
    if (!currentDraft) return;

    if (currentDraft.status !== "reviewed") {
      setMessage({
        type: "error",
        text: "✗ KBA muss erst geprüft werden (Status: 'reviewed')",
      });
      return;
    }

    if (hasPendingChanges) {
      setMessage({ type: "error", text: "✗ Bitte erst Änderungen speichern" });
      return;
    }

    // TODO: Rechteprüfung hier einbauen
    // Example implementation:
    // const { user } = useAuth();
    // if (!user.hasPermission('kba.publish')) {
    //   setMessage({ type: "error", text: "Keine Berechtigung zum Veröffentlichen" });
    //   return;
    // }
    // Backend should also validate permissions in /api/kba/drafts/{id}/publish endpoint

    setLoading(true);
    setMessage(null);

    try {
      const result = await api.publishKBADraft(currentDraft.id, {
        // TODO: Make configurable via UI dropdown or settings page
        // Options: "file", "sharepoint", "itsm", "confluence"
        // Could be stored in user preferences or per-draft metadata
        target_system: "file",
        // TODO: Get from auth context (same as above)
        user_id: "user@example.com",
      });
      
      setMessage({
        type: "success",
        text: `✓ KBA veröffentlicht: ${result.published_id || result.published_url}`,
      });
      
      const updated = await api.getKBADraft(currentDraft.id);
      setCurrentDraft(updated);
      setEditedDraft(JSON.parse(JSON.stringify(updated)));
      setEditMode(false);
      loadDrafts();
    } catch (error) {
      setMessage({ type: "error", text: "✗ Fehler beim Veröffentlichen: " + error.message });
    } finally {
      setLoading(false);
    }
  };

  // Handler: Load Draft from List
  const loadDraft = async (draftId) => {
    if (hasPendingChanges) {
      if (!window.confirm("Nicht gespeicherte Änderungen verwerfen?")) {
        return;
      }
    }

    try {
      const draft = await api.getKBADraft(draftId);
      setCurrentDraft(draft);
      setEditedDraft(JSON.parse(JSON.stringify(draft)));
      setEditMode(false);
    } catch (error) {
      setMessage({ type: "error", text: "Fehler beim Laden des Entwurfs" });
    }
  };

  // Handler: Delete Draft
  const deleteDraft = (draftId, draftTitle) => {
    setDraftToDelete({ id: draftId, title: draftTitle });
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    setDeleteDialogOpen(false);
    if (!draftToDelete) return;
    
    try {
      await api.deleteKBADraft(draftToDelete.id, "anonymous");
      setMessage({ type: "success", text: "Entwurf erfolgreich gelöscht" });
      
      // Refresh draft list
      const response = await api.listKBADrafts({ limit: 10 });
      setDrafts(response.drafts);
      
      // Close current draft if it was deleted
      if (currentDraft && currentDraft.id === draftToDelete.id) {
        setCurrentDraft(null);
        setEditedDraft(null);
        setEditMode(false);
      }
      setDraftToDelete(null);
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Fehler beim Löschen des Entwurfs" });
      setDraftToDelete(null);
    }
  };

  // Handler: Close Draft
  const handleClose = () => {
    if (hasPendingChanges) {
      if (!window.confirm("Nicht gespeicherte Änderungen verwerfen?")) {
        return;
      }
    }
    setCurrentDraft(null);
    setEditedDraft(null);
    setEditMode(false);
  };

  // Active draft for display (edited or current)
  const displayDraft = editedDraft || currentDraft;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div>
        <h1>
          <DocumentText24Regular /> KBA Drafter
        </h1>
        <p style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS, overflowWrap: "break-word", wordBreak: "break-word" }}>
          Erstellen Sie Knowledge Base Articles aus Support-Tickets mit KI-Unterstützung
        </p>
      </div>

      {/* LLM Status Warning */}
      {llmAvailable === false && (
        <MessageBar intent="warning" style={{ overflowWrap: "break-word" }}>
          <MessageBarBody>
            <MessageBarTitle>LLM nicht verfügbar</MessageBarTitle>
            Der KBA-Generator ist derzeit nicht verfügbar. Bitte überprüfen Sie die Backend-Konfiguration.
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Global Message Bar */}
      {message && (
        <MessageBar 
          intent={message.type === "error" ? "error" : "success"}
          style={{ overflowWrap: "break-word" }}
        >
          <MessageBarBody>{message.text}</MessageBarBody>
        </MessageBar>
      )}

      {/* Input Section: Generate New Draft */}
      <Card>
        <CardHeader
          header={<strong>Neuen KBA-Entwurf erstellen</strong>}
          description="Geben Sie die UUID oder Incident-ID des Support-Tickets ein"
        />
        <div style={{ padding: tokens.spacingVerticalL }}>
          <div className={styles.inputSection}>
            <Field
              label="Ticket-ID (UUID oder INC-Nummer)"
              validationMessage={ticketIdError}
              validationState={ticketIdError ? "error" : undefined}
              style={{ flex: 1 }}
            >
              <Input
                id="ticketId"
                value={ticketId}
                onChange={(e) => {
                  setTicketId(e.target.value);
                  if (ticketIdError) setTicketIdError("");
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !loading) {
                    handleGenerate();
                  }
                }}
                placeholder="INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000"
                disabled={loading}
              />
            </Field>
            <Button
              appearance="primary"
              icon={<Send24Regular />}
              onClick={() => handleGenerate(false)}
              disabled={loading || !llmAvailable || !ticketId.trim()}
            >
              {loading ? "Generiere..." : "Entwurf erstellen"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Current Draft Editor/Viewer */}
      {displayDraft && (
        <Card className={styles.draftCard}>
          <CardHeader
            header={
              <div className={styles.draftHeader}>
                <div>
                  <strong>KBA-Entwurf</strong>
                  {hasPendingChanges && (
                    <span className={styles.pendingIndicator}> • Nicht gespeichert</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center", marginLeft: tokens.spacingHorizontalL }}>
                  <Badge
                    appearance="filled"
                    color={getStatusBadgeColor(displayDraft.status)}
                  >
                    {displayDraft.status}
                  </Badge>
                  {displayDraft.incident_id && (
                    <Badge appearance="outline" className={styles.statusBadge}>
                      {displayDraft.incident_id}
                    </Badge>
                  )}
                  {displayDraft.status === "draft" && (
                    <Button
                      appearance="subtle"
                      icon={editMode ? <Eye24Regular /> : <Edit24Regular />}
                      onClick={toggleEditMode}
                      size="small"
                    >
                      {editMode ? "Vorschau" : "Bearbeiten"}
                    </Button>
                  )}
                </div>
              </div>
            }
          />
          <div className={styles.draftContent}>
            {/* Title */}
            <Field label="Titel">
              {editMode ? (
                <Input
                  value={displayDraft.title || ""}
                  onChange={(e) => handleFieldChange("title", e.target.value)}
                  style={{ width: "100%" }}
                />
              ) : (
                <div style={{ fontWeight: "600", fontSize: "16px", overflowWrap: "break-word", wordBreak: "break-word" }}>
                  {displayDraft.title}
                </div>
              )}
            </Field>

            {/* Symptoms */}
            {(editMode || (displayDraft.symptoms && displayDraft.symptoms.length > 0)) && (
              <div>
                {editMode ? (
                  <EditableList
                    items={displayDraft.symptoms || []}
                    onChange={(newSymptoms) => handleFieldChange("symptoms", newSymptoms)}
                    label="Symptome & Fehlermeldungen"
                    itemLabel="Symptom"
                    multiline={true}
                    placeholder="Beschreiben Sie ein Symptom oder eine Fehlermeldung..."
                  />
                ) : (
                  <>
                    <Label>Symptome & Fehlermeldungen</Label>
                    <ul className={styles.solutionSteps}>
                      {displayDraft.symptoms.map((symptom, idx) => (
                        <li key={idx}>{symptom}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Root Cause */}
            {displayDraft.cause && (
              <div>
                <Label>Ursache (Root Cause)</Label>
                {editMode ? (
                  <Textarea
                    value={displayDraft.cause}
                    onChange={(e) => handleFieldChange("cause", e.target.value)}
                    rows={3}
                    style={{ width: "100%" }}
                  />
                ) : (
                  <p style={{ fontStyle: "italic", color: tokens.colorNeutralForeground2, overflowWrap: "break-word", wordBreak: "break-word" }}>
                    {displayDraft.cause}
                  </p>
                )}
              </div>
            )}

            {/* Resolution Steps */}
            <div>
              {editMode ? (
                <EditableList
                  items={displayDraft.resolution_steps || displayDraft.solution_steps || []}
                  onChange={(newSteps) => handleFieldChange("resolution_steps", newSteps)}
                  label="Lösungsschritte"
                  itemLabel="Schritt"
                  multiline={true}
                  allowReorder={true}
                  placeholder="Beschreiben Sie einen Lösungsschritt..."
                />
              ) : (
                <>
                  <Label>Lösungsschritte</Label>
                  <ol className={styles.solutionSteps}>
                    {(displayDraft.resolution_steps || displayDraft.solution_steps || []).map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            {/* Validation Checks */}
            {(editMode || (displayDraft.validation_checks && displayDraft.validation_checks.length > 0)) && (
              <div>
                {editMode ? (
                  <EditableList
                    items={displayDraft.validation_checks || []}
                    onChange={(newChecks) => handleFieldChange("validation_checks", newChecks)}
                    label="Verifikationsschritte"
                    itemLabel="Check"
                    multiline={true}
                    placeholder="Beschreiben Sie einen Verifikationsschritt..."
                  />
                ) : (
                  <>
                    <Label>Verifikationsschritte</Label>
                    <ul className={styles.solutionSteps}>
                      {displayDraft.validation_checks.map((check, idx) => (
                        <li key={idx} style={{ color: tokens.colorPaletteDarkOrangeBackground3, overflowWrap: "break-word", wordBreak: "break-word" }}>
                          ✓ {check}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Warnings */}
            {(editMode || (displayDraft.warnings && displayDraft.warnings.length > 0)) && (
              <div>
                {editMode ? (
                  <EditableList
                    items={displayDraft.warnings || []}
                    onChange={(newWarnings) => handleFieldChange("warnings", newWarnings)}
                    label="Wichtige Hinweise & Warnungen"
                    itemLabel="Warnung"
                    multiline={true}
                    placeholder="Beschreiben Sie eine wichtige Warnung..."
                  />
                ) : (
                  <MessageBar intent="warning">
                    <MessageBarBody style={{ padding: "12px" }}>
                      <MessageBarTitle>
                        Wichtige Hinweise & Warnungen
                      </MessageBarTitle>
                      <ul style={{ 
                        margin: "8px 0 0 0", 
                        paddingLeft: "20px",
                        overflowWrap: "break-word", 
                        wordBreak: "break-word",
                        listStylePosition: "outside"
                      }}>
                        {displayDraft.warnings.map((warning, idx) => (
                          <li key={idx} style={{ 
                            marginBottom: "4px",
                            overflowWrap: "break-word", 
                            wordBreak: "break-word" 
                          }}>
                            {warning}
                          </li>
                        ))}
                      </ul>
                    </MessageBarBody>
                  </MessageBar>
                )}
              </div>
            )}

            {/* Confidence Notes */}
            {(editMode || displayDraft.confidence_notes) && (
              <div>
                {editMode ? (
                  <Field label="LLM-Hinweis / Einschränkungen">
                    <Textarea
                      value={displayDraft.confidence_notes || ""}
                      onChange={(e) => handleFieldChange("confidence_notes", e.target.value)}
                      rows={3}
                      placeholder="Zusätzliche Hinweise oder Einschränkungen..."
                      style={{ width: "100%" }}
                    />
                  </Field>
                ) : (
                  <MessageBar intent="info">
                    <MessageBarBody style={{ padding: "12px" }}>
                      <MessageBarTitle>LLM-Hinweis / Einschränkungen</MessageBarTitle>
                      <div style={{ 
                        margin: "8px 0 0 0",
                        overflowWrap: "break-word", 
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap"
                      }}>
                        {displayDraft.confidence_notes}
                      </div>
                    </MessageBarBody>
                  </MessageBar>
                )}
              </div>
            )}

            {/* Tags */}
            <div>
              {editMode ? (
                <TagEditor
                  tags={displayDraft.tags || []}
                  onChange={(newTags) => handleFieldChange("tags", newTags)}
                  label="Tags"
                />
              ) : (
                <>
                  <Label>Tags</Label>
                  <TagGroup style={{ marginTop: tokens.spacingVerticalXS }}>
                    {(displayDraft.tags || []).map((tag, idx) => (
                      <Tag key={idx} size="small">
                        {tag}
                      </Tag>
                    ))}
                  </TagGroup>
                </>
              )}
            </div>

            {/* Search Questions */}
            <div>
              <Label>Häufige Suchanfragen</Label>
              <Text size={200} style={{ display: "block", marginBottom: tokens.spacingVerticalS }}>
                Wie könnten Benutzer nach diesem KBA suchen?
              </Text>
              {editMode ? (
                <EditableList
                  items={displayDraft.search_questions || []}
                  onChange={(newQuestions) => handleFieldChange("search_questions", newQuestions)}
                  placeholder="z.B. Wie behebe ich VPN-Verbindungsprobleme?"
                  minLength={10}
                  maxLength={200}
                />
              ) : (
                <ul style={{ marginTop: tokens.spacingVerticalXS, paddingLeft: tokens.spacingHorizontalL }}>
                  {(displayDraft.search_questions || []).map((question, idx) => (
                    <li key={idx} style={{ marginBottom: tokens.spacingVerticalXXS }}>
                      {question}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Action Buttons */}
            <div className={styles.actions}>
              {/* Replace Button (Draft/Reviewed Status, not in edit mode) */}
              {(displayDraft.status === "draft" || displayDraft.status === "reviewed") && !editMode && (
                <Button
                  appearance="subtle"
                  onClick={handleReplace}
                  disabled={loading}
                >
                  Mit neuem KBA ersetzen
                </Button>
              )}
              
              {/* Save Button (Edit Mode) */}
              {editMode && (
                <Button
                  appearance="primary"
                  icon={<Save24Regular />}
                  onClick={handleSave}
                  disabled={!hasPendingChanges || saving}
                >
                  {saving ? "Speichere..." : "Speichern"}
                </Button>
              )}

              {/* Review Button (Draft Status) */}
              {displayDraft.status === "draft" && !editMode && (
                <Button
                  appearance="primary"
                  icon={<Checkmark24Regular />}
                  onClick={handleReview}
                  disabled={saving || hasPendingChanges}
                >
                  Als geprüft markieren
                </Button>
              )}

              {/* Publish Button (Reviewed Status) */}
              {displayDraft.status === "reviewed" && (
                <Button
                  appearance="primary"
                  icon={<Save24Regular />}
                  onClick={handlePublish}
                  disabled={loading || hasPendingChanges}
                >
                  In Knowledge Base übernehmen
                </Button>
              )}

              {/* Close Button */}
              <Button
                icon={<Dismiss24Regular />}
                onClick={handleClose}
                disabled={loading || saving}
              >
                Schließen
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Recent Drafts List */}
      {!currentDraft && drafts.length > 0 && (
        <Card>
          <CardHeader header={<strong>Letzte Entwürfe</strong>} />
          <div style={{ padding: tokens.spacingVerticalM }}>
            {drafts.map((draft) => (
              <Card
                key={draft.id}
                style={{ 
                  marginBottom: tokens.spacingVerticalS,
                  cursor: "pointer",
                  transition: "background 0.2s",
                  position: "relative"
                }}
                onClick={() => loadDraft(draft.id)}
              >
                <div style={{ padding: tokens.spacingVerticalM, paddingBottom: tokens.spacingVerticalL }}>
                  <Badge 
                    appearance="filled" 
                    color={getStatusBadgeColor(draft.status)}
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px"
                    }}
                  >
                    {draft.status}
                  </Badge>
                  <div>
                    <strong style={{ overflowWrap: "break-word", wordBreak: "break-word", paddingRight: "80px" }}>{draft.title}</strong>
                  </div>
                  <div style={{ fontSize: "12px", color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS, overflowWrap: "break-word", wordBreak: "break-word" }}>
                    {draft.incident_id} • {new Date(draft.created_at).toLocaleString("de-DE")}
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteDraft(draft.id, draft.title);
                    }}
                    title="Entwurf löschen"
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: "24px",
                      height: "24px",
                      backgroundColor: "#d13438",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                      borderTopLeftRadius: "4px"
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#a82c30"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#d13438"}
                  >
                    <Dismiss20Regular
                      style={{
                        color: "white",
                        fontSize: "14px",
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Loading Overlay with Blur */}
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingContent}>
            <Spinner size="huge" />
            <Text size={500} weight="semibold">
              {currentDraft ? "Entwurf wird neu generiert..." : "Generiere KBA-Entwurf..."}
            </Text>
          </div>
        </div>
      )}
      
      {/* Duplicate KBA Dialog */}
      <DuplicateKBADialog
        open={duplicateDialogOpen}
        existingDrafts={existingDrafts}
        onCancel={handleCancelDuplicate}
        onViewExisting={handleViewExisting}
        onCreateNew={handleForceCreate}
      />
      
      {/* Replace Confirm Dialog */}
      <ConfirmDialog
        open={replaceDialogOpen}
        title="KBA-Entwurf ersetzen"
        message="Möchten Sie diesen KBA-Entwurf wirklich mit neu generiertem Inhalt ersetzen? Alle bisherigen Inhalte gehen verloren."
        confirmText="Ersetzen"
        cancelText="Abbrechen"
        intent="danger"
        onConfirm={confirmReplace}
        onCancel={() => setReplaceDialogOpen(false)}
      />
      
      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Entwurf löschen"
        message={draftToDelete ? `Möchten Sie den Entwurf "${draftToDelete.title}" wirklich löschen?` : ""}
        confirmText="Löschen"
        cancelText="Abbrechen"
        intent="danger"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setDraftToDelete(null);
        }}
      />
    </div>
  );
}
