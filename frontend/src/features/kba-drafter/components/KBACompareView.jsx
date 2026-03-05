import React, { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  Button,
  Text,
  Badge,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
  Divider,
  Tag,
  TagGroup,
  Textarea,
  Label,
} from "@fluentui/react-components";
import {
  ArrowLeft20Regular,
  Checkmark20Regular,
  DocumentAdd20Regular,
  Sparkle20Regular,
  Warning20Regular,
  CheckmarkCircle20Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  container: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actionButtons: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
  },
  compareLayout: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingHorizontalL,
    "@media (max-width: 768px)": {
      gridTemplateColumns: "1fr",
    },
  },
  columnHeader: {
    fontWeight: 600,
    fontSize: "16px",
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  sectionCard: {
    marginBottom: tokens.spacingVerticalM,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: "14px",
    marginBottom: "8px",
    color: tokens.colorNeutralForeground2,
  },
  listItem: {
    marginBottom: "6px",
    paddingLeft: "8px",
    borderLeft: `2px solid ${tokens.colorNeutralStroke2}`,
  },
  analysisCard: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: "16px",
    borderRadius: tokens.borderRadiusMedium,
    marginTop: "16px",
  },
  analysisTitle: {
    fontWeight: 600,
    marginBottom: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  metaInfo: {
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
    marginTop: "4px",
  },
  emptyText: {
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
    fontSize: "13px",
  },
});

/**
 * KBACompareView - Compares ticket problem with existing KBA
 * 
 * @param {Object} props
 * @param {Object} props.ticketData - Ticket information
 * @param {Object} props.kbaDraft - Existing KBA draft to compare
 * @param {string} props.ticketId - Ticket ID for API call
 * @param {Function} props.onBack - Called when user wants to go back
 * @param {Function} props.onUseExisting - Called when user chooses to use existing KBA
 * @param {Function} props.onCreateNew - Called when user chooses to create new KBA
 * @param {Function} props.onCompareAPI - Optional: Fetch LLM comparison
 */
export default function KBACompareView({
  ticketData,
  kbaDraft,
  ticketId,
  onBack,
  onUseExisting,
  onCreateNew,
  onCompareAPI,
}) {
  const styles = useStyles();
  const [llmAnalysis, setLlmAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [userNote, setUserNote] = useState(""); // User's optional reasoning/note

  useEffect(() => {
    // Auto-fetch LLM analysis if function provided
    if (onCompareAPI && kbaDraft && ticketId) {
      fetchLLMAnalysis();
    }
  }, [kbaDraft?.id, ticketId]);

  const fetchLLMAnalysis = async () => {
    if (!onCompareAPI) return;
    
    setLoadingAnalysis(true);
    setAnalysisError(null);
    
    try {
      const result = await onCompareAPI(kbaDraft.id, ticketId);
      setLlmAnalysis(result);
    } catch (error) {
      console.error("Failed to fetch LLM analysis:", error);
      setAnalysisError(error.message);
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusLower = status?.toLowerCase() || "";
    const colorMap = {
      published: "success",
      reviewed: "informative",
      draft: "warning",
    };
    return (
      <Badge appearance="tint" color={colorMap[statusLower] || "subtle"}>
        {status}
      </Badge>
    );
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <Card>
        <CardHeader
          header={
            <div className={styles.header}>
              <div>
                <Text weight="semibold" size={500}>
                  Vergleich: Ticket vs. Bestehender KBA
                </Text>
                <Text size={200} className={styles.metaInfo}>
                  Prüfen Sie, ob der bestehende KBA das Problem abdeckt
                </Text>
              </div>
              <div className={styles.actionButtons}>
                <Button
                  appearance="secondary"
                  icon={<ArrowLeft20Regular />}
                  onClick={onBack}
                >
                  Zurück
                </Button>
              </div>
            </div>
          }
        />
      </Card>

      {/* LLM Analysis (if available) */}
      {loadingAnalysis && (
        <Card>
          <CardHeader
            header={
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <Spinner size="small" />
                <Text>KI-Analyse läuft...</Text>
              </div>
            }
          />
        </Card>
      )}

      {analysisError && (
        <MessageBar intent="warning">
          <MessageBarBody>
            KI-Analyse konnte nicht geladen werden: {analysisError}
          </MessageBarBody>
        </MessageBar>
      )}

      {llmAnalysis && (
        <Card className={styles.analysisCard}>
          <div className={styles.analysisTitle}>
            <Sparkle20Regular />
            <Text weight="semibold">KI-Bewertung: Strukturierte Analyse</Text>
            
            {/* Recommendation Badge */}
            {llmAnalysis.recommendation === "keep_existing" && (
              <Badge appearance="filled" color="success" icon={<Checkmark20Regular />}>
                Bestehenden KBA verwenden
              </Badge>
            )}
            {llmAnalysis.recommendation === "create_new" && (
              <Badge appearance="filled" color="danger" icon={<Warning20Regular />}>
                Neuen KBA erstellen
              </Badge>
            )}
            {llmAnalysis.recommendation === "merge_candidate" && (
              <Badge appearance="filled" color="warning">
                Zusammenführen erwägen
              </Badge>
            )}
            
            {/* Duplicate Likelihood Badge */}
            <Badge appearance="tint" color="informative">
              Übereinstimmung: {Math.round((llmAnalysis.duplicate_likelihood || 0) * 100)}%
            </Badge>
          </div>
          
          {/* Match Summary */}
          <div style={{ marginTop: "16px", marginBottom: "16px" }}>
            <Text weight="semibold" style={{ display: "block", marginBottom: "6px" }}>
              Zusammenfassung:
            </Text>
            <Text>{llmAnalysis.match_summary || llmAnalysis.analysis || "Keine Zusammenfassung verfügbar"}</Text>
          </div>
          
          {/* Strengths */}
          {llmAnalysis.strengths_existing_kba && llmAnalysis.strengths_existing_kba.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <Text weight="semibold" style={{ display: "block", marginBottom: "6px", color: tokens.colorPaletteGreenForeground1 }}>
                ✓ Stärken des bestehenden KBA:
              </Text>
              <ul style={{ margin: "0", paddingLeft: "24px" }}>
                {llmAnalysis.strengths_existing_kba.map((strength, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>
                    <Text size={300}>{strength}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Gaps */}
          {llmAnalysis.gaps_existing_kba && llmAnalysis.gaps_existing_kba.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <Text weight="semibold" style={{ display: "block", marginBottom: "6px", color: tokens.colorPaletteRedForeground1 }}>
                ⚠ Lücken/Schwächen:
              </Text>
              <ul style={{ margin: "0", paddingLeft: "24px" }}>
                {llmAnalysis.gaps_existing_kba.map((gap, idx) => (
                  <li key={idx} style={{ marginBottom: "4px" }}>
                    <Text size={300}>{gap}</Text>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Recommendation Reason */}
          {llmAnalysis.recommendation_reason && (
            <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: tokens.colorNeutralBackground3, borderRadius: tokens.borderRadiusMedium }}>
              <Text weight="semibold" style={{ display: "block", marginBottom: "6px" }}>
                💡 Begründung:
              </Text>
              <Text>{llmAnalysis.recommendation_reason || llmAnalysis.recommendation || "Keine Begründung verfügbar"}</Text>
            </div>
          )}
          
          {/* Confidence Notes */}
          {llmAnalysis.confidence_notes && (
            <div style={{ padding: "12px", backgroundColor: tokens.colorNeutralBackground2, borderRadius: tokens.borderRadiusMedium, borderLeft: `3px solid ${tokens.colorPaletteYellowBorder1}` }}>
              <Text size={200} style={{ fontStyle: "italic" }}>
                <strong>Hinweis:</strong> {llmAnalysis.confidence_notes}
              </Text>
            </div>
          )}
          
          {/* Legacy fields fallback (backwards compatibility) */}
          {!llmAnalysis.match_summary && llmAnalysis.analysis && (
            <div style={{ marginTop: "16px" }}>
              <Text weight="semibold" style={{ display: "block", marginBottom: "6px" }}>
                Analyse (Legacy):
              </Text>
              <Text>{llmAnalysis.analysis}</Text>
            </div>
          )}
          
          {llmAnalysis.confidence !== undefined && llmAnalysis.duplicate_likelihood === undefined && (
            <Text size={200} className={styles.metaInfo} style={{ marginTop: "8px" }}>
              Konfidenz (Legacy): {Math.round((llmAnalysis.confidence || 0) * 100)}%
            </Text>
          )}
        </Card>
      )}

      {/* Comparison Grid */}
      <div className={styles.compareLayout}>
        {/* Left Column: Ticket Problem */}
        <div>
          <div className={styles.columnHeader}>
            <Warning20Regular />
            Ticket-Problem
          </div>

          <Card className={styles.sectionCard}>
            <div className={styles.sectionTitle}>Zusammenfassung</div>
            <Text>{ticketData?.summary || "Keine Zusammenfassung"}</Text>
            <Text size={200} className={styles.metaInfo}>
              Ticket: {ticketData?.incident_id || ticketId}
            </Text>
          </Card>

          {ticketData?.notes && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Notizen</div>
              <Text>{ticketData.notes}</Text>
            </Card>
          )}

          {ticketData?.resolution && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Lösung (aus Ticket)</div>
              <Text>{ticketData.resolution}</Text>
            </Card>
          )}

          <Card className={styles.sectionCard}>
            <div className={styles.sectionTitle}>Metadaten</div>
            <Text size={200}>
              Status: {ticketData?.status || "Unbekannt"} <br />
              Priorität: {ticketData?.priority || "Unbekannt"} <br />
              Assignee: {ticketData?.assignee || "Nicht zugewiesen"}
            </Text>
          </Card>
        </div>

        {/* Right Column: Existing KBA */}
        <div>
          <div className={styles.columnHeader}>
            <CheckmarkCircle20Regular />
            Bestehender KBA {getStatusBadge(kbaDraft?.status)}
          </div>

          <Card className={styles.sectionCard}>
            <div className={styles.sectionTitle}>Titel</div>
            <Text weight="semibold">{kbaDraft?.title || "Kein Titel"}</Text>
            <Text size={200} className={styles.metaInfo}>
              Erstellt: {new Date(kbaDraft?.created_at).toLocaleDateString("de-DE")}
            </Text>
          </Card>

          {kbaDraft?.symptoms && kbaDraft.symptoms.length > 0 && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Symptome</div>
              {kbaDraft.symptoms.map((symptom, idx) => (
                <div key={idx} className={styles.listItem}>
                  <Text size={300}>{symptom}</Text>
                </div>
              ))}
            </Card>
          )}

          {kbaDraft?.cause && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Ursache</div>
              <Text>{kbaDraft.cause}</Text>
            </Card>
          )}

          {kbaDraft?.resolution_steps && kbaDraft.resolution_steps.length > 0 && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Lösungsschritte</div>
              {kbaDraft.resolution_steps.map((step, idx) => (
                <div key={idx} className={styles.listItem}>
                  <Text size={300}>{step}</Text>
                </div>
              ))}
            </Card>
          )}

          {kbaDraft?.tags && kbaDraft.tags.length > 0 && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Tags</div>
              <TagGroup>
                {kbaDraft.tags.map((tag, idx) => (
                  <Tag key={idx} size="small" shape="rounded">
                    {tag}
                  </Tag>
                ))}
              </TagGroup>
            </Card>
          )}

          {kbaDraft?.validation_checks && kbaDraft.validation_checks.length > 0 && (
            <Card className={styles.sectionCard}>
              <div className={styles.sectionTitle}>Validierung</div>
              {kbaDraft.validation_checks.map((check, idx) => (
                <div key={idx} className={styles.listItem}>
                  <Text size={300}>{check}</Text>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <Card>
        <div style={{ padding: "16px" }}>
          {/* Optional User Note */}
          <div style={{ marginBottom: "16px" }}>
            <Label weight="semibold" style={{ marginBottom: "8px", display: "block" }}>
              Optionale Notiz (empfohlen)
            </Label>
            <Text size={200} style={{ marginBottom: "8px", display: "block", color: tokens.colorNeutralForeground3 }}>
              Begründen Sie Ihre Entscheidung für die Audit-Nachverfolgung
            </Text>
            <Textarea
              value={userNote}
              onChange={(e) => setUserNote(e.target.value)}
              placeholder="z.B. 'Bestehender KBA deckt das Problem vollständig ab' oder 'Neuer KBA nötig wegen spezifischer Windows 11 22H2 Details'"
              resize="vertical"
              rows={3}
              style={{ width: "100%" }}
            />
          </div>
          
          {/* Decision Buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "16px",
              borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
            }}
          >
            <Text weight="semibold">Entscheidung treffen</Text>
            <div className={styles.actionButtons}>
              <Button
                appearance="secondary"
                icon={<Checkmark20Regular />}
                onClick={() => onUseExisting(userNote)}
              >
                Bestehenden KBA behalten
              </Button>
              <Button
                appearance="primary"
                icon={<DocumentAdd20Regular />}
                onClick={() => onCreateNew(userNote)}
              >
                Neuen KBA erstellen
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
