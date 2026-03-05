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
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  Dropdown,
  Option,
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
  AlertUrgent20Regular,
  Lightbulb20Regular,
  Target20Regular,
  CheckmarkCircle20Regular,
  Tag20Regular,
  Search20Regular,
  DocumentSearch20Regular,
  ArrowUndo24Regular,
  MoreVertical20Regular,
} from "@fluentui/react-icons";
import * as api from "../../services/api";
import EditableList from "./components/EditableList";
import TagEditor from "./components/TagEditor";
import DuplicateKBADialog from "./components/DuplicateKBADialog";
import ConfirmDialog from "./components/ConfirmDialog";
import AutoGenSettings from "./components/AutoGenSettings";
import SimilarKBAsDialog from "./components/SimilarKBAsDialog";
import KBACompareView from "./components/KBACompareView";

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
  sectionHeader: {
    fontSize: "18px",
    fontWeight: "600",
    color: tokens.colorBrandForeground1,
    marginBottom: tokens.spacingVerticalM,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  sectionDivider: {
    height: "1px",
    backgroundColor: tokens.colorNeutralStroke2,
    margin: `${tokens.spacingVerticalL} 0`,
  },
  kbaTitle: {
    fontSize: "24px",
    fontWeight: "700",
    color: tokens.colorNeutralForeground1,
    lineHeight: "1.3",
    marginBottom: tokens.spacingVerticalM,
  },
  fieldSection: {
    marginBottom: tokens.spacingVerticalL,
  },
  listItem: {
    marginBottom: tokens.spacingVerticalS,
    lineHeight: "1.5",
    overflowWrap: "break-word",
    wordBreak: "break-word",
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
  const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  // Ticket Viewer Dialog State
  const [ticketDialogOpen, setTicketDialogOpen] = useState(false);
  const [ticketData, setTicketData] = useState(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  
  // Status Warning Dialog State
  const [statusWarningOpen, setStatusWarningOpen] = useState(false);
  const [pendingTicket, setPendingTicket] = useState(null);
  
  // Similarity Check State
  const [similarDialogOpen, setSimilarDialogOpen] = useState(false);
  const [similarityResult, setSimilarityResult] = useState(null);
  const [compareViewOpen, setCompareViewOpen] = useState(false);
  const [selectedKBAForCompare, setSelectedKBAForCompare] = useState(null);
  const [compareTicketData, setCompareTicketData] = useState(null);
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState("all");

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

  // Auto-scroll to top when opening a draft
  useEffect(() => {
    if (currentDraft) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentDraft]);

  // Handler: Check ticket status before generating KBA Draft
  const handleGenerateClick = async () => {
    if (!validateTicketId(ticketId)) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Load ticket to check status
      const trimmedId = ticketId.trim();
      let ticket;
      
      // Check if it's UUID or Incident-ID format
      if (UUID_REGEX.test(trimmedId)) {
        ticket = await api.getCSVTicket(trimmedId);
      } else if (INCIDENT_ID_REGEX.test(trimmedId)) {
        ticket = await api.getCSVTicketByIncident(trimmedId);
      }

      if (!ticket) {
        throw new Error("Ticket nicht gefunden");
      }

      // Check if ticket status is Resolved or Closed
      const status = ticket.status?.toLowerCase();
      if (status !== "resolved" && status !== "closed") {
        // Show warning dialog
        setPendingTicket(ticket);
        setStatusWarningOpen(true);
        setLoading(false);
        return;
      }

      // Status is OK, proceed directly
      await handleGenerate(false);
      
    } catch (error) {
      setLoading(false);
      setMessage({
        type: "error",
        text: error.message || "Fehler beim Laden des Tickets",
      });
    }
  };

  // Handler: Generate KBA Draft from Ticket (actual generation)
  const handleGenerate = async (forceCreate = false) => {
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
      // Handle similar KBAs found (new 409 response)
      if (error.status === 409 && error.data?.similar_matches) {
        setSimilarityResult({
          similar_matches: error.data.similar_matches,
          existing_drafts: error.data.existing_drafts || [],
        });
        setPendingTicketId(ticketId.trim());
        setSimilarDialogOpen(true);
        setLoading(false);
        return;
      }
      
      // Handle duplicate draft error (409) - legacy format
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
    setTicketId(pendingTicketId);
    handleGenerate(true);
  };
  
  // Handler: Cancel duplicate dialog
  const handleCancelDuplicate = () => {
    setDuplicateDialogOpen(false);
    setExistingDrafts([]);
    setPendingTicketId(null);
  };
  
  // Handler: Open comparison view from similar KBAs dialog
  const handleCompareSimilar = async (kbaDraft) => {
    setSimilarDialogOpen(false);
    
    // Load ticket data for comparison
    try {
      const trimmedId = pendingTicketId || ticketId.trim();
      let ticket;
      
      if (UUID_REGEX.test(trimmedId)) {
        ticket = await api.getCSVTicket(trimmedId);
      } else if (INCIDENT_ID_REGEX.test(trimmedId)) {
        ticket = await api.getCSVTicketByIncident(trimmedId);
      }
      
      setCompareTicketData(ticket);
      setSelectedKBAForCompare(kbaDraft);
      setCompareViewOpen(true);
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Fehler beim Laden der Ticket-Daten",
      });
    }
  };
  
  // Handler: Create new KBA from similar dialog (force create)
  const handleCreateNewAfterSimilarity = async () => {
    setSimilarDialogOpen(false);
    
    // Log decision to create new without comparison
    try {
      await api.logSimilarityDecision({
        ticket_id: pendingTicketId || ticketId.trim(),
        user_id: "user@example.com", // TODO: Get from auth context
        similarity_check_performed: true,
        match_count: similarityResult?.primary_matches?.length || 0 + similarityResult?.draft_matches?.length || 0,
        threshold_used: 0.5,
        strong_match_found: (similarityResult?.primary_matches || []).some(m => m.similarity_score >= 0.7) ||
                          (similarityResult?.draft_matches || []).some(m => m.similarity_score >= 0.7),
        highest_similarity_score: Math.max(
          ...(similarityResult?.primary_matches || []).map(m => m.similarity_score),
          ...(similarityResult?.draft_matches || []).map(m => m.similarity_score),
          0
        ),
        decision: "create_new",
        user_note: "User chose to create new KBA without detailed comparison",
        context_data: {
          comparison_used: false,
          matches_ignored: true,
        },
      });
    } catch (error) {
      console.error("Failed to log similarity decision:", error);
    }
    
    handleGenerate(true);
  };
  
  // Handler: Cancel similarity dialog
  const handleCancelSimilarity = async () => {
    setSimilarDialogOpen(false);
    
    // Log cancellation for audit trail
    try {
      await api.logSimilarityDecision({
        ticket_id: pendingTicketId || ticketId.trim(),
        user_id: "user@example.com", // TODO: Get from auth context        similarity_check_performed: true,
        match_count: similarityResult?.primary_matches?.length || 0 + similarityResult?.draft_matches?.length || 0,
        threshold_used: 0.5,
        strong_match_found: (similarityResult?.primary_matches || []).some(m => m.similarity_score >= 0.7) ||
                          (similarityResult?.draft_matches || []).some(m => m.similarity_score >= 0.7),
        highest_similarity_score: Math.max(
          ...(similarityResult?.primary_matches || []).map(m => m.similarity_score),
          ...(similarityResult?.draft_matches || []).map(m => m.similarity_score),
          0
        ),
        decision: "cancelled",
        user_note: "User cancelled the workflow",
        context_data: {
          comparison_used: false,
        },
      });
    } catch (error) {
      console.error("Failed to log similarity decision:", error);
    }
    
    setSimilarityResult(null);
    setPendingTicketId(null);
  };
  
  // Handler: Use existing KBA from compare view
  const handleUseExistingKBA = async (userNote = "") => {
    setCompareViewOpen(false);
    
    // Log similarity decision for audit trail
    try {
      await api.logSimilarityDecision({
        ticket_id: pendingTicketId || ticketId.trim(),
        user_id: "user@example.com", // TODO: Get from auth context
        similarity_check_performed: true,
        match_count: similarityResult?.primary_matches?.length || 0 + similarityResult?.draft_matches?.length || 0,
        threshold_used: 0.5,
        strong_match_found: (similarityResult?.primary_matches || []).some(m => m.similarity_score >= 0.7) ||
                          (similarityResult?.draft_matches || []).some(m => m.similarity_score >= 0.7),
        highest_similarity_score: Math.max(
          ...(similarityResult?.primary_matches || []).map(m => m.similarity_score),
          ...(similarityResult?.draft_matches || []).map(m => m.similarity_score),
          0
        ),
        decision: "keep_existing",
        selected_existing_kba_id: selectedKBAForCompare?.id,
        user_note: userNote || undefined,
        context_data: {
          comparison_used: true,
          llm_recommendation: similarityResult?.recommendation || null,
        },
      });
    } catch (error) {
      console.error("Failed to log similarity decision:", error);
      // Continue anyway - logging failure shouldn't block workflow
    }
    
    if (selectedKBAForCompare) {
      await handleViewExisting(selectedKBAForCompare.id);
    }
    
    setSelectedKBAForCompare(null);
    setCompareTicketData(null);
    setSimilarityResult(null);
  };
  
  // Handler: Create new KBA from compare view
  const handleCreateNewFromCompare = async (userNote = "") => {
    setCompareViewOpen(false);
    setSelectedKBAForCompare(null);
    setCompareTicketData(null);
    
    // Log decision before creating new draft
    try {
      await api.logSimilarityDecision({
        ticket_id: pendingTicketId || ticketId.trim(),
        user_id: "user@example.com", // TODO: Get from auth context
        similarity_check_performed: true,
        match_count: similarityResult?.primary_matches?.length || 0 + similarityResult?.draft_matches?.length || 0,
        threshold_used: 0.5,
        strong_match_found: (similarityResult?.primary_matches || []).some(m => m.similarity_score >= 0.7) ||
                          (similarityResult?.draft_matches || []).some(m => m.similarity_score >= 0.7),
        highest_similarity_score: Math.max(
          ...(similarityResult?.primary_matches || []).map(m => m.similarity_score),
          ...(similarityResult?.draft_matches || []).map(m => m.similarity_score),
          0
        ),
        decision: "create_new_after_compare",
        user_note: userNote || undefined,
        context_data: {
          comparison_used: true,
          compared_with_kba_id: selectedKBAForCompare?.id,
        },
      });
    } catch (error) {
      console.error("Failed to log similarity decision:", error);
    }
    
    // Now create the new draft
    handleGenerate(true);
  };
  
  // Handler: Go back from compare view to similar KBAs dialog
  const handleBackToSimilarDialog = () => {
    setCompareViewOpen(false);
    setSelectedKBAForCompare(null);
    setCompareTicketData(null);
    setSimilarDialogOpen(true);
  };
  
  // Handler: Fetch LLM comparison analysis
  const handleFetchCompareAnalysis = async (draftId, ticketId) => {
    try {
      const result = await api.compareKBAWithTicket(draftId, ticketId);
      return result;
    } catch (error) {
      console.error("Failed to fetch compare analysis:", error);
      throw error;
    }
  };
  
  // Handler: Proceed with generation despite status warning
  const handleProceedWithWarning = () => {
    setStatusWarningOpen(false);
    setPendingTicket(null);
    handleGenerate(false);
  };
  
  // Handler: Cancel generation from status warning
  const handleCancelWarning = () => {
    setStatusWarningOpen(false);
    setPendingTicket(null);
    setLoading(false);
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
      setEditMode(false);
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
      setPendingAction('toggleEdit');
      setUnsavedChangesDialogOpen(true);
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

  // Handler: Unreview (back to draft)
  const handleUnreview = async () => {
    if (!currentDraft) return;

    setSaving(true);
    try {
      const updated = await api.updateKBADraft(
        currentDraft.id,
        { status: "draft" },
        "user@example.com"
      );
      setCurrentDraft(updated);
      setEditedDraft(JSON.parse(JSON.stringify(updated)));
      setMessage({ type: "success", text: "✓ Zurück zu Entwurf" });
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
      setPendingAction({ type: 'loadDraft', draftId });
      setUnsavedChangesDialogOpen(true);
      return;
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
      setDrafts(response.items || []);
      
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
      setPendingAction('closeDraft');
      setUnsavedChangesDialogOpen(true);
      return;
    }
    setCurrentDraft(null);
    setEditedDraft(null);
    setEditMode(false);
  };

  // Handler: Discard Unsaved Changes
  const handleDiscardChanges = async () => {
    setUnsavedChangesDialogOpen(false);

    if (pendingAction === 'toggleEdit') {
      setEditedDraft(JSON.parse(JSON.stringify(currentDraft)));
      setEditMode(false);
    } else if (pendingAction === 'closeDraft') {
      setCurrentDraft(null);
      setEditedDraft(null);
      setEditMode(false);
    } else if (pendingAction?.type === 'loadDraft') {
      try {
        const draft = await api.getKBADraft(pendingAction.draftId);
        setCurrentDraft(draft);
        setEditedDraft(JSON.parse(JSON.stringify(draft)));
        setEditMode(false);
      } catch (error) {
        setMessage({ type: "error", text: "Fehler beim Laden des Entwurfs" });
      }
    }

    setPendingAction(null);
  };

  // Handler: Cancel Discard
  const handleCancelDiscard = () => {
    setUnsavedChangesDialogOpen(false);
    setPendingAction(null);
  };

  // Handler: View Ticket
  const handleViewTicket = async () => {
    if (!displayDraft?.incident_id) {
      setMessage({
        type: "error",
        text: "Keine Ticket-ID verfügbar",
      });
      return;
    }

    setLoadingTicket(true);
    setTicketDialogOpen(true);
    
    try {
      const ticket = await api.getCSVTicketByIncident(displayDraft.incident_id);
      setTicketData(ticket);
    } catch (error) {
      setMessage({
        type: "error",
        text: `Fehler beim Laden des Tickets: ${error.message}`,
      });
      setTicketDialogOpen(false);
    } finally {
      setLoadingTicket(false);
    }
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

      {/* Auto-Generation Settings */}
      <AutoGenSettings />

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
                    handleGenerateClick();
                  }
                }}
                placeholder="INC000016349815 oder 550e8400-e29b-41d4-a716-446655440000"
                disabled={loading}
              />
            </Field>
            <Button
              appearance="primary"
              icon={<Send24Regular />}
              onClick={handleGenerateClick}
              disabled={loading || !llmAvailable || !ticketId.trim()}
            >
              {loading ? "Generiere..." : "Entwurf erstellen"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Current Draft Editor/Viewer */}
      {displayDraft && (
        <Card className={styles.draftCard} style={{ position: "relative" }}>
          {/* Close Button - Top Right Corner */}
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={handleClose}
            disabled={loading || saving}
            size="small"
            style={{ 
              position: "absolute",
              top: "16px",
              right: "16px",
              zIndex: 10,
              minWidth: "32px",
              padding: "6px"
            }}
            title="Schließen"
          />
          
          <CardHeader
            header={
              <div className={styles.draftHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: tokens.spacingHorizontalL, flex: 1 }}>
                  <div>
                    <strong>KBA-Entwurf</strong>
                    {hasPendingChanges && (
                      <span className={styles.pendingIndicator}> • Nicht gespeichert</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: tokens.spacingHorizontalS, alignItems: "center" }}>
                    <Badge
                      appearance="filled"
                      color={getStatusBadgeColor(displayDraft.status)}
                    >
                      {displayDraft.status}
                    </Badge>
                    {displayDraft.is_auto_generated && (
                      <Badge 
                        appearance="tint" 
                        color="informative"
                        style={{ fontSize: "11px" }}
                      >
                        🤖 AutoGen
                      </Badge>
                    )}
                    {displayDraft.incident_id && (
                      <Badge appearance="outline" className={styles.statusBadge}>
                        {displayDraft.incident_id}
                      </Badge>
                    )}
                    {displayDraft.incident_id && (
                      <Button
                        appearance="subtle"
                        icon={<DocumentSearch20Regular />}
                        onClick={handleViewTicket}
                        size="small"
                      >
                        Ticket
                      </Button>
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
              </div>
            }
          />
          <div className={styles.draftContent}>
            {/* Title */}
            <div className={styles.fieldSection}>
              {editMode ? (
                <>
                  <div className={styles.sectionHeader}>
                    <DocumentText24Regular />
                    Titel
                  </div>
                  <Input
                    value={displayDraft.title || ""}
                    onChange={(e) => handleFieldChange("title", e.target.value)}
                    style={{ width: "100%" }}
                  />
                </>
              ) : (
                <div className={styles.kbaTitle}>
                  {displayDraft.title}
                </div>
              )}
            </div>

            <div className={styles.sectionDivider} />

            {/* Symptoms */}
            {(editMode || (displayDraft.symptoms && displayDraft.symptoms.length > 0)) && (
              <div className={styles.fieldSection}>
                {editMode ? (
                  <>
                    <div className={styles.sectionHeader}>
                      <AlertUrgent20Regular />
                      Symptome & Fehlermeldungen
                    </div>
                    <EditableList
                      items={displayDraft.symptoms || []}
                      onChange={(newSymptoms) => handleFieldChange("symptoms", newSymptoms)}
                      itemLabel="Symptom"
                      multiline={true}
                      placeholder="Beschreiben Sie ein Symptom oder eine Fehlermeldung..."
                    />
                  </>
                ) : (
                  <>
                    <div className={styles.sectionHeader}>
                      <AlertUrgent20Regular />
                      Symptome & Fehlermeldungen
                    </div>
                    <ul className={styles.solutionSteps}>
                      {displayDraft.symptoms.map((symptom, idx) => (
                        <li key={idx} className={styles.listItem}>{symptom}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Root Cause */}
            {(editMode || displayDraft.cause) && (
              <div className={styles.fieldSection}>
                {editMode ? (
                  <>
                    <div className={styles.sectionHeader}>
                      <Lightbulb20Regular />
                      Ursache (Root Cause)
                    </div>
                    <Textarea
                      value={displayDraft.cause || ""}
                      onChange={(e) => handleFieldChange("cause", e.target.value)}
                      rows={3}
                      style={{ width: "100%" }}
                      placeholder="Beschreiben Sie die Ursache des Problems..."
                    />
                  </>
                ) : (
                  <>
                    <div className={styles.sectionHeader}>
                      <Lightbulb20Regular />
                      Ursache (Root Cause)
                    </div>
                    <p style={{ fontStyle: "italic", color: tokens.colorNeutralForeground2, overflowWrap: "break-word", wordBreak: "break-word", lineHeight: "1.5" }}>
                      {displayDraft.cause}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className={styles.sectionDivider} />

            {/* Resolution Steps */}
            <div className={styles.fieldSection}>
              {editMode ? (
                <>
                  <div className={styles.sectionHeader}>
                    <Target20Regular />
                    Lösungsschritte
                  </div>
                  <EditableList
                    items={displayDraft.resolution_steps || displayDraft.solution_steps || []}
                    onChange={(newSteps) => handleFieldChange("resolution_steps", newSteps)}
                    itemLabel="Schritt"
                    multiline={true}
                    allowReorder={true}
                    placeholder="Beschreiben Sie einen Lösungsschritt..."
                  />
                </>
              ) : (
                <>
                  <div className={styles.sectionHeader}>
                    <Target20Regular />
                    Lösungsschritte
                  </div>
                  <ol className={styles.solutionSteps}>
                    {(displayDraft.resolution_steps || displayDraft.solution_steps || []).map((step, idx) => (
                      <li key={idx} className={styles.listItem}>{step}</li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            {/* Validation Checks */}
            {(editMode || (displayDraft.validation_checks && displayDraft.validation_checks.length > 0)) && (
              <div className={styles.fieldSection}>
                {editMode ? (
                  <>
                    <div className={styles.sectionHeader}>
                      <CheckmarkCircle20Regular />
                      Verifikationsschritte
                    </div>
                    <EditableList
                      items={displayDraft.validation_checks || []}
                      onChange={(newChecks) => handleFieldChange("validation_checks", newChecks)}
                      itemLabel="Check"
                      multiline={true}
                      placeholder="Beschreiben Sie einen Verifikationsschritt..."
                    />
                  </>
                ) : (
                  <>
                    <div className={styles.sectionHeader}>
                      <CheckmarkCircle20Regular />
                      Verifikationsschritte
                    </div>
                    <ul className={styles.solutionSteps}>
                      {displayDraft.validation_checks.map((check, idx) => (
                        <li key={idx} className={styles.listItem} style={{ color: tokens.colorPaletteGreenForeground1 }}>
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
              <div className={styles.fieldSection}>
                {editMode ? (
                  <>
                    <div className={styles.sectionHeader}>
                      <Warning24Regular />
                      Wichtige Hinweise & Warnungen
                    </div>
                    <EditableList
                      items={displayDraft.warnings || []}
                      onChange={(newWarnings) => handleFieldChange("warnings", newWarnings)}
                      itemLabel="Warnung"
                      multiline={true}
                      placeholder="Beschreiben Sie eine wichtige Warnung..."
                    />
                  </>
                ) : (
                  <MessageBar intent="warning">
                    <MessageBarBody style={{ padding: "12px" }}>
                      <MessageBarTitle style={{ fontSize: "16px", fontWeight: "600" }}>
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
                          <li key={idx} className={styles.listItem}>
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
              <div className={styles.fieldSection}>
                {editMode ? (
                  <>
                    <div className={styles.sectionHeader}>
                      <Lightbulb20Regular />
                      LLM-Hinweis / Einschränkungen
                    </div>
                    <Textarea
                      value={displayDraft.confidence_notes || ""}
                      onChange={(e) => handleFieldChange("confidence_notes", e.target.value)}
                      rows={3}
                      placeholder="Zusätzliche Hinweise oder Einschränkungen..."
                      style={{ width: "100%" }}
                    />
                  </>
                ) : (
                  <MessageBar intent="info">
                    <MessageBarBody style={{ padding: "12px" }}>
                      <MessageBarTitle style={{ fontSize: "16px", fontWeight: "600" }}>
                        LLM-Hinweis / Einschränkungen
                      </MessageBarTitle>
                      <div style={{ 
                        margin: "8px 0 0 0",
                        overflowWrap: "break-word", 
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        lineHeight: "1.5"
                      }}>
                        {displayDraft.confidence_notes}
                      </div>
                    </MessageBarBody>
                  </MessageBar>
                )}
              </div>
            )}

            <div className={styles.sectionDivider} />

            {/* Tags */}
            <div className={styles.fieldSection}>
              {editMode ? (
                <>
                  <div className={styles.sectionHeader}>
                    <Tag20Regular />
                    Tags
                  </div>
                  <TagEditor
                    tags={displayDraft.tags || []}
                    onChange={(newTags) => handleFieldChange("tags", newTags)}
                  />
                </>
              ) : (
                <>
                  <div className={styles.sectionHeader}>
                    <Tag20Regular />
                    Tags
                  </div>
                  <TagGroup style={{ marginTop: tokens.spacingVerticalXS }}>
                    {(displayDraft.tags || []).map((tag, idx) => (
                      <Tag key={idx} size="medium" appearance="brand">
                        {tag}
                      </Tag>
                    ))}
                  </TagGroup>
                </>
              )}
            </div>

            {/* Search Questions */}
            <div className={styles.fieldSection}>
              {editMode ? (
                <>
                  <div className={styles.sectionHeader}>
                    <Search20Regular />
                    Häufige Suchanfragen
                  </div>
                  <Text size={200} style={{ display: "block", marginBottom: tokens.spacingVerticalS, color: tokens.colorNeutralForeground3 }}>
                    Wie könnten Benutzer nach diesem KBA suchen?
                  </Text>
                  <EditableList
                    items={displayDraft.search_questions || []}
                    onChange={(newQuestions) => handleFieldChange("search_questions", newQuestions)}
                    placeholder="z.B. Wie behebe ich VPN-Verbindungsprobleme?"
                    minLength={10}
                    maxLength={200}
                  />
                </>
              ) : (
                <>
                  <div className={styles.sectionHeader}>
                    <Search20Regular />
                    Häufige Suchanfragen
                  </div>
                  <ul style={{ marginTop: tokens.spacingVerticalXS, paddingLeft: tokens.spacingHorizontalL }}>
                    {(displayDraft.search_questions || []).map((question, idx) => (
                      <li key={idx} className={styles.listItem} style={{ fontStyle: "italic", color: tokens.colorNeutralForeground2 }}>
                        {question}
                      </li>
                    ))}
                  </ul>
                </>
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

              {/* Unreview Button (Reviewed Status) */}
              {displayDraft.status === "reviewed" && (
                <Button
                  appearance="subtle"
                  icon={<ArrowUndo24Regular />}
                  onClick={handleUnreview}
                  disabled={saving}
                >
                  Zurück zu Entwurf
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
          <CardHeader 
            header={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                <strong>Letzte Entwürfe</strong>
                <Dropdown
                  placeholder="Status filtern"
                  value={statusFilter === "all" ? "Alle Status" : statusFilter}
                  selectedOptions={[statusFilter]}
                  onOptionSelect={(e, data) => setStatusFilter(data.optionValue)}
                  size="small"
                  style={{ minWidth: "150px" }}
                >
                  <Option value="all">Alle Status</Option>
                  <Option value="draft">draft</Option>
                  <Option value="reviewed">reviewed</Option>
                  <Option value="published">published</Option>
                </Dropdown>
              </div>
            } 
          />
          <div style={{ padding: tokens.spacingVerticalM }}>
            {drafts
              .filter(draft => statusFilter === "all" || draft.status === statusFilter)
              .map((draft) => (
              <Card
                key={draft.id}
                style={{ 
                  marginBottom: tokens.spacingVerticalS,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onClick={() => loadDraft(draft.id)}
              >
                <div style={{ 
                  padding: tokens.spacingVerticalM,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: tokens.spacingHorizontalM,
                }}>
                  {/* Left: Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: "14px",
                      fontWeight: 600,
                      marginBottom: tokens.spacingVerticalXXS,
                      overflowWrap: "break-word",
                      wordBreak: "break-word"
                    }}>
                      {draft.title}
                    </div>
                    <div style={{ 
                      fontSize: "12px",
                      color: tokens.colorNeutralForeground3,
                      display: "flex",
                      gap: tokens.spacingHorizontalS,
                      flexWrap: "wrap",
                      alignItems: "center"
                    }}>
                      <span>{draft.incident_id}</span>
                      <span>•</span>
                      <span>{new Date(draft.created_at).toLocaleString("de-DE")}</span>
                    </div>
                  </div>
                  
                  {/* Right: Status Badge */}
                  <div style={{ display: "flex", gap: tokens.spacingHorizontalXS, justifyContent: "flex-end", minWidth: "80px" }}>
                    <Badge 
                      appearance="filled" 
                      color={getStatusBadgeColor(draft.status)}
                      size="large"
                    >
                      {draft.status}
                    </Badge>
                    {draft.is_auto_generated && (
                      <Badge 
                        appearance="tint" 
                        color="informative"
                        size="small"
                        style={{ fontSize: "10px" }}
                      >
                        🤖
                      </Badge>
                    )}
                  </div>
                  
                  {/* Right: Menu */}
                  <div style={{ marginLeft: tokens.spacingHorizontalL }}>
                    <Menu>
                      <MenuTrigger disableButtonEnhancement>
                        <Button
                          appearance="subtle"
                          icon={<MoreVertical20Regular />}
                          size="small"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </MenuTrigger>
                      <MenuPopover>
                        <MenuList>
                          <MenuItem
                            icon={<Delete24Regular />}
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDraft(draft.id, draft.title);
                            }}
                          >
                            Löschen
                          </MenuItem>
                        </MenuList>
                      </MenuPopover>
                    </Menu>
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
      
      {/* Status Warning Dialog */}
      <ConfirmDialog
        open={statusWarningOpen}
        title="Ticket-Status Warnung"
        message={
          pendingTicket 
            ? `Das Ticket "${pendingTicket.incident_id || ticketId}" hat den Status "${pendingTicket.status}". ` +
              `KBA-Drafts werden normalerweise nur für Tickets mit Status "Resolved" oder "Closed" erstellt.\n\n` +
              `Möchten Sie trotzdem fortfahren?`
            : ""
        }
        confirmText="Trotzdem erstellen"
        cancelText="Abbrechen"
        intent="warning"
        onConfirm={handleProceedWithWarning}
        onCancel={handleCancelWarning}
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

      {/* Ticket Viewer Dialog */}
      <Dialog
        open={ticketDialogOpen}
        onOpenChange={(event, data) => setTicketDialogOpen(data.open)}
      >
        <DialogSurface style={{ maxWidth: "600px" }}>
          <DialogTitle>Ticket Details</DialogTitle>
          <DialogBody>
            {loadingTicket ? (
              <div style={{ display: "flex", justifyContent: "center", padding: tokens.spacingVerticalXXL }}>
                <Spinner size="large" label="Lade Ticket..." />
              </div>
            ) : ticketData ? (
              <DialogContent>
                <div style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}>
                  {/* Incident ID */}
                  <div>
                    <Label weight="semibold">Incident ID</Label>
                    <Text block>{ticketData.incident_id || "N/A"}</Text>
                  </div>

                  {/* Summary */}
                  <div>
                    <Label weight="semibold">Summary</Label>
                    <Text block>{ticketData.summary || "N/A"}</Text>
                  </div>

                  {/* Status */}
                  <div>
                    <Label weight="semibold">Status</Label>
                    <Badge appearance="filled" color={getStatusBadgeColor(ticketData.status)}>
                      {ticketData.status || "N/A"}
                    </Badge>
                  </div>

                  {/* Priority & Urgency */}
                  <div style={{ display: "flex", gap: tokens.spacingHorizontalL }}>
                    <div style={{ flex: 1 }}>
                      <Label weight="semibold">Priority</Label>
                      <Text block>{ticketData.priority || "N/A"}</Text>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Label weight="semibold">Urgency</Label>
                      <Text block>{ticketData.urgency || "N/A"}</Text>
                    </div>
                  </div>

                  {/* Assignee & Group */}
                  <div style={{ display: "flex", gap: tokens.spacingHorizontalL }}>
                    <div style={{ flex: 1 }}>
                      <Label weight="semibold">Assigned Person</Label>
                      <Text block>{ticketData.assigned_person || "N/A"}</Text>
                    </div>
                    <div style={{ flex: 1 }}>
                      <Label weight="semibold">Assigned Group</Label>
                      <Text block>{ticketData.assigned_group || "N/A"}</Text>
                    </div>
                  </div>

                  {/* Notes */}
                  {ticketData.notes && (
                    <div>
                      <Label weight="semibold">Notes</Label>
                      <div
                        style={{
                          maxHeight: "200px",
                          overflowY: "auto",
                          padding: tokens.spacingVerticalS,
                          backgroundColor: tokens.colorNeutralBackground2,
                          borderRadius: tokens.borderRadiusMedium,
                        }}
                      >
                        <Text block style={{ whiteSpace: "pre-wrap" }}>
                          {ticketData.notes}
                        </Text>
                      </div>
                    </div>
                  )}

                  {/* Resolution */}
                  {ticketData.resolution && (
                    <div>
                      <Label weight="semibold">Resolution</Label>
                      <div
                        style={{
                          maxHeight: "200px",
                          overflowY: "auto",
                          padding: tokens.spacingVerticalS,
                          backgroundColor: tokens.colorNeutralBackground2,
                          borderRadius: tokens.borderRadiusMedium,
                        }}
                      >
                        <Text block style={{ whiteSpace: "pre-wrap" }}>
                          {ticketData.resolution}
                        </Text>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            ) : (
              <Text>Keine Ticket-Daten verfügbar</Text>
            )}
          </DialogBody>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={() => setTicketDialogOpen(false)}
            >
              Schließen
            </Button>
          </DialogActions>
        </DialogSurface>
      </Dialog>

      {/* Unsaved Changes Dialog */}
      <ConfirmDialog
        open={unsavedChangesDialogOpen}
        title="Nicht gespeicherte Änderungen"
        message="Sie haben nicht gespeicherte Änderungen. Möchten Sie diese verwerfen?"
        confirmText="Änderungen verwerfen"
        cancelText="Abbrechen"
        intent="warning"
        onConfirm={handleDiscardChanges}
        onCancel={handleCancelDiscard}
      />

      {/* Similar KBAs Dialog */}
      <SimilarKBAsDialog
        open={similarDialogOpen}
        similarityResult={similarityResult}
        loading={false}
        onCancel={handleCancelSimilarity}
        onCompare={handleCompareSimilar}
        onCreateNew={handleCreateNewAfterSimilarity}
      />

      {/* KBA Compare View - mounts as full page overlay */}
      {compareViewOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: tokens.colorNeutralBackground1,
            zIndex: 10000,
            overflow: "auto",
            padding: tokens.spacingVerticalXL,
          }}
        >
          <KBACompareView
            ticketData={compareTicketData}
            kbaDraft={selectedKBAForCompare}
            ticketId={pendingTicketId || ticketId.trim()}
            onBack={handleBackToSimilarDialog}
            onUseExisting={handleUseExistingKBA}
            onCreateNew={handleCreateNewFromCompare}
            onCompareAPI={handleFetchCompareAnalysis}
          />
        </div>
      )}
    </div>
  );
}
