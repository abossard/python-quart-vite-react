import React from "react";
import {
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Badge,
  Table,
  TableBody,
  TableCell,
  TableRow,
  tokens,
} from "@fluentui/react-components";
import { Warning24Regular } from "@fluentui/react-icons";

/**
 * DuplicateKBADialog - Dialog shown when trying to create a KBA for a ticket that already has one
 * 
 * Options:
 * - Abbrechen: Close dialog, do nothing
 * - Zum KBA: Load and view the existing draft
 * - (Optional) Trotzdem neu: Force create a new draft (only shown when multiple drafts exist)
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {Array} props.existingDrafts - Array of existing draft objects
 * @param {Function} props.onCancel - Called when user cancels
 * @param {Function} props.onViewExisting - Called with draft ID when user wants to view
 * @param {Function} props.onCreateNew - Called when user wants to force create
 */
export default function DuplicateKBADialog({
  open,
  existingDrafts = [],
  onCancel,
  onViewExisting,
  onCreateNew,
}) {
  const formatDate = (dateStr) => {
    if (!dateStr) return "Unbekannt";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
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

  // If only one draft exists, provide quick action to view it
  const hasSingleDraft = existingDrafts.length === 1;
  const handleViewPrimary = () => {
    if (hasSingleDraft) {
      onViewExisting(existingDrafts[0].id);
    }
  };

  return (
    <Dialog open={open} modalType="modal">
      <DialogSurface style={{ maxWidth: "600px" }}>
        <DialogBody>
          <DialogTitle>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Warning24Regular style={{ color: tokens.colorPaletteYellowForeground1 }} />
              KBA-Entwurf bereits vorhanden
            </div>
          </DialogTitle>
          
          <DialogContent>
            <p>
              Für dieses Ticket existiert bereits {existingDrafts.length === 1 ? "ein KBA-Entwurf" : `${existingDrafts.length} KBA-Entwürfe`}.
            </p>

            <div style={{ marginTop: "16px", marginBottom: "16px" }}>
              <Table size="small">
                <TableBody>
                  {existingDrafts.map((draft) => (
                    <TableRow
                      key={draft.id}
                      style={{
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      onClick={() => onViewExisting(draft.id)}
                    >
                      <TableCell>
                        <Badge
                          appearance="outline"
                          color={getStatusColor(draft.status)}
                          size="small"
                        >
                          {draft.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div style={{ fontWeight: 500, overflowWrap: "break-word", wordBreak: "break-word" }}>{draft.title || "Ohne Titel"}</div>
                        {draft.incident_id && (
                          <div style={{ fontSize: "12px", color: tokens.colorNeutralForeground2, overflowWrap: "break-word", wordBreak: "break-word" }}>
                            {draft.incident_id}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div style={{ fontSize: "12px", color: tokens.colorNeutralForeground2, overflowWrap: "break-word", wordBreak: "break-word" }}>
                          {formatDate(draft.created_at)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {!hasSingleDraft && (
              <p style={{ fontSize: "14px", color: tokens.colorNeutralForeground2, overflowWrap: "break-word", wordBreak: "break-word" }}>
                <strong>Tipp:</strong> Klicken Sie auf einen Entwurf um ihn anzusehen.
              </p>
            )}
          </DialogContent>
          
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              Abbrechen
            </Button>
            {hasSingleDraft ? (
              <Button appearance="primary" onClick={handleViewPrimary}>
                Zum KBA
              </Button>
            ) : (
              <>
                <Button appearance="primary" onClick={onCreateNew}>
                  Trotzdem neu erstellen
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
