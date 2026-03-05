import React from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Badge,
  Card,
  CardHeader,
  Text,
  tokens,
  makeStyles,
  Divider,
  Tag,
  TagGroup,
} from "@fluentui/react-components";
import {
  DocumentSearch24Regular,
  Sparkle20Regular,
  DocumentText20Regular,
  Tag20Regular,
  ArrowRight20Regular,
} from "@fluentui/react-icons";

const useStyles = makeStyles({
  dialogSurface: {
    maxWidth: "900px",
    minWidth: "600px",
  },
  headerSection: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  matchesSection: {
    marginTop: "20px",
    marginBottom: "20px",
  },
  sectionTitle: {
    fontWeight: 600,
    marginBottom: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  matchCard: {
    marginBottom: "12px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    ":hover": {
      boxShadow: tokens.shadow8,
      borderColor: tokens.colorBrandStroke1,
    },
  },
  matchHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
  },
  matchTitleSection: {
    flex: 1,
  },
  matchTitle: {
    fontWeight: 600,
    fontSize: "14px",
    marginBottom: "4px",
    color: tokens.colorNeutralForeground1,
  },
  matchDetails: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
  },
  matchReason: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
  },
  scoreBadge: {
    minWidth: "60px",
    textAlign: "center",
  },
  emptyState: {
    textAlign: "center",
    padding: "40px 20px",
    color: tokens.colorNeutralForeground3,
  },
  emptyStateIcon: {
    fontSize: "48px",
    marginBottom: "16px",
    opacity: 0.5,
  },
  warningSection: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    marginTop: "16px",
    marginBottom: "16px",
  },
  infoText: {
    fontSize: "13px",
    color: tokens.colorNeutralForeground2,
    marginBottom: "8px",
  },
  draftHint: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    marginTop: "12px",
    fontSize: "12px",
    color: tokens.colorNeutralForeground3,
  },
});

/**
 * SimilarKBAsDialog - Shows similar KBAs found before creating a new draft
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {Object} props.similarityResult - Result from similarity check API
 * @param {boolean} props.loading - Whether similarity check is in progress
 * @param {Function} props.onCancel - Called when user cancels
 * @param {Function} props.onCompare - Called with draft when user wants to compare
 * @param {Function} props.onCreateNew - Called when user wants to create new draft anyway
 */
export default function SimilarKBAsDialog({
  open,
  similarityResult,
  loading = false,
  onCancel,
  onCompare,
  onCreateNew,
}) {
  const styles = useStyles();

  const getScoreBadge = (score, isStrong) => {
    const percentage = Math.round(score * 100);
    
    if (isStrong || score >= 0.7) {
      return (
        <Badge
          appearance="filled"
          color="warning"
          className={styles.scoreBadge}
        >
          {percentage}% - Stark
        </Badge>
      );
    } else if (score >= 0.5) {
      return (
        <Badge
          appearance="tint"
          color="informative"
          className={styles.scoreBadge}
        >
          {percentage}%
        </Badge>
      );
    }
    return (
      <Badge appearance="outline" className={styles.scoreBadge}>
        {percentage}%
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const renderMatchCard = (match) => (
    <Card
      key={match.draft.id}
      className={styles.matchCard}
      onClick={() => onCompare(match.draft)}
    >
      <CardHeader
        header={
          <div className={styles.matchHeader}>
            <div className={styles.matchTitleSection}>
              <div className={styles.matchTitle}>{match.draft.title}</div>
              <div className={styles.matchDetails}>
                <div className={styles.matchReason}>
                  <DocumentText20Regular />
                  Status: {match.draft.status} • Erstellt: {formatDate(match.draft.created_at)}
                </div>
                
                {match.match_reasons && match.match_reasons.length > 0 && (
                  <div className={styles.matchReason}>
                    <Sparkle20Regular />
                    {match.match_reasons.join(" • ")}
                  </div>
                )}
                
                {match.draft.tags && match.draft.tags.length > 0 && (
                  <TagGroup size="small">
                    {match.draft.tags.slice(0, 5).map((tag, idx) => (
                      <Tag key={idx} size="small" shape="rounded">
                        {tag}
                      </Tag>
                    ))}
                  </TagGroup>
                )}
              </div>
            </div>
            <div>
              {getScoreBadge(match.similarity_score, match.is_strong_match)}
            </div>
          </div>
        }
      />
    </Card>
  );

  const hasPrimaryMatches = similarityResult?.primary_matches?.length > 0;
  const hasDraftMatches = similarityResult?.draft_matches?.length > 0;
  const hasAnyMatches = hasPrimaryMatches || hasDraftMatches;
  const usedFallback = similarityResult?.used_fallback || false;

  return (
    <Dialog open={open} modalType="modal">
      <DialogSurface className={styles.dialogSurface}>
        <DialogBody>
          <DialogTitle>
            <div className={styles.headerSection}>
              <DocumentSearch24Regular />
              Ähnliche KBAs gefunden
            </div>
          </DialogTitle>

          <DialogContent>
            {loading ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyStateIcon}>🔍</div>
                <Text>Suche nach ähnlichen KBAs...</Text>
              </div>
            ) : (
              <>
                {usedFallback && (
                  <div className={styles.warningSection}>
                    <Text size={200}>
                      ⚠️ Keyword-basierte Suche aktiv (OpenAI nicht verfügbar)
                    </Text>
                  </div>
                )}

                <Text className={styles.infoText}>
                  {similarityResult?.query_text && (
                    <>Suche für: "<strong>{similarityResult.query_text}</strong>"</>
                  )}
                </Text>

                {hasAnyMatches ? (
                  <>
                    {/* Primary Matches (reviewed/published) */}
                    {hasPrimaryMatches && (
                      <div className={styles.matchesSection}>
                        <div className={styles.sectionTitle}>
                          <CheckmarkCircle20Regular />
                          <Text weight="semibold">
                            Qualitätsgeprüfte KBAs ({similarityResult.primary_matches.length})
                          </Text>
                        </div>
                        {similarityResult.primary_matches.map(renderMatchCard)}
                      </div>
                    )}

                    {/* Draft Matches (separate hint section) */}
                    {hasDraftMatches && (
                      <div className={styles.matchesSection}>
                        <div className={styles.sectionTitle}>
                          <DocumentText20Regular />
                          <Text weight="semibold">
                            Entwürfe in Bearbeitung ({similarityResult.draft_matches.length})
                          </Text>
                        </div>
                        <div className={styles.draftHint}>
                          <Text size={200}>
                            💡 Diese Entwürfe sind noch nicht geprüft und dienen nur zur Information.
                          </Text>
                        </div>
                        {similarityResult.draft_matches.map(renderMatchCard)}
                      </div>
                    )}

                    <Divider style={{ marginTop: "20px", marginBottom: "16px" }} />
                    
                    <Text size={200} className={styles.infoText}>
                      Sie können einen KBA zum Vergleichen auswählen oder direkt einen neuen erstellen.
                    </Text>
                  </>
                ) : (
                  /* Empty State */
                  <div className={styles.emptyState}>
                    <div className={styles.emptyStateIcon}>
                      <DocumentSearch24Regular />
                    </div>
                    <Text weight="semibold" size={400}>
                      Keine ähnlichen KBAs gefunden
                    </Text>
                    <Text size={300} style={{ marginTop: "8px" }}>
                      Es wurden keine vergleichbaren Knowledge Base Artikel gefunden.
                      Sie können einen neuen KBA-Entwurf erstellen.
                    </Text>
                  </div>
                )}
              </>
            )}
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              Abbrechen
            </Button>
            <Button
              appearance="primary"
              onClick={onCreateNew}
              disabled={loading}
              icon={<ArrowRight20Regular />}
              iconPosition="after"
            >
              {hasAnyMatches ? "Trotzdem neuen KBA erstellen" : "Neuen KBA erstellen"}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
