import React from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  tokens,
} from "@fluentui/react-components";
import { Warning24Regular } from "@fluentui/react-icons";

/**
 * ConfirmDialog - Reusable confirmation dialog
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Confirmation message
 * @param {string} props.confirmText - Text for confirm button (default: "Bestätigen")
 * @param {string} props.cancelText - Text for cancel button (default: "Abbrechen")
 * @param {string} props.intent - Intent for confirm button: "primary" | "danger" (default: "primary")
 * @param {Function} props.onConfirm - Called when user confirms
 * @param {Function} props.onCancel - Called when user cancels
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Bestätigen",
  cancelText = "Abbrechen",
  intent = "primary",
  onConfirm,
  onCancel,
}) {
  return (
    <Dialog open={open} onOpenChange={(event, data) => !data.open && onCancel()}>
      <DialogSurface style={{ maxWidth: "500px" }}>
        <DialogBody>
          <DialogTitle>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {intent === "danger" && (
                <Warning24Regular style={{ color: tokens.colorPaletteRedForeground1 }} />
              )}
              {title}
            </div>
          </DialogTitle>
          
          <DialogContent>
            <p style={{ margin: 0, lineHeight: "1.5" }}>{message}</p>
          </DialogContent>
          
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              {cancelText}
            </Button>
            <Button 
              appearance={intent === "danger" ? "primary" : "primary"}
              style={intent === "danger" ? { backgroundColor: tokens.colorPaletteRedBackground3 } : {}}
              onClick={onConfirm}
            >
              {confirmText}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
