import { useState } from "react";
import {
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Badge,
  Spinner,
  Text,
  Title3,
  Body1,
  Body1Strong,
  MessageBar,
  MessageBarBody,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
} from "@fluentui/react-components";
import {
  SearchRegular,
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  SplitVerticalRegular,
} from "@fluentui/react-icons";
import { analyzeTicketsForSplitting, splitTicket } from "../../services/api";

export default function TicketSplitterPage() {
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState([]);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [limit, setLimit] = useState(20);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [splitting, setSplitting] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setAnalyses([]);

    try {
      const response = await analyzeTicketsForSplitting({ limit });
      setAnalyses(response.analyses || []);
      setSuccess(
        `Analyzed ${response.total_analyzed} tickets. Found ${response.multiple_problems_found} with multiple problems.`
      );
    } catch (err) {
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSplit = async (analysis) => {
    setSplitting(true);
    setError(null);

    try {
      const result = await splitTicket(
        analysis.original_ticket_id,
        analysis.secondary_problems
      );

      if (result.success) {
        setSuccess(
          `Successfully created ${result.created_tickets.length} split ticket(s)!`
        );
        // Remove this analysis from the list
        setAnalyses((prev) =>
          prev.filter((a) => a.original_ticket_id !== analysis.original_ticket_id)
        );
        setSelectedAnalysis(null);
      } else {
        setError(result.message || "Failed to create split tickets");
      }
    } catch (err) {
      setError(`Split failed: ${err.message}`);
    } finally {
      setSplitting(false);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      CRITICAL: "danger",
      HIGH: "warning",
      MEDIUM: "important",
      LOW: "informative",
    };
    return colors[priority] || "subtle";
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: "danger",
      high: "warning",
      medium: "important",
      low: "informative",
    };
    return colors[severity?.toLowerCase()] || "subtle";
  };

  // Filter to only show analyses with multiple problems
  const multiProblemAnalyses = analyses.filter((a) => a.has_multiple_problems);

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "20px" }}>
        <Title3>Ticket Splitter</Title3>
        <Body1 style={{ marginTop: "8px", marginBottom: "20px" }}>
          Analyze tickets to identify those describing multiple distinct problems.
          Split them into separate tickets for better tracking.
        </Body1>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Button
            appearance="primary"
            icon={<SearchRegular />}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? "Analyzing..." : "Analyze Tickets"}
          </Button>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Body1>Limit:</Body1>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              min="1"
              max="100"
              style={{
                width: "80px",
                padding: "6px 8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <Spinner size="large" label="Analyzing tickets with AI..." />
        </div>
      )}

      {error && (
        <MessageBar intent="error" style={{ marginBottom: "16px" }}>
          <MessageBarBody>
            <Body1Strong>Error:</Body1Strong> {error}
          </MessageBarBody>
        </MessageBar>
      )}

      {success && (
        <MessageBar intent="success" style={{ marginBottom: "16px" }}>
          <MessageBarBody>{success}</MessageBarBody>
        </MessageBar>
      )}

      {!loading && multiProblemAnalyses.length > 0 && (
        <Card>
          <div style={{ padding: "16px" }}>
            <Body1Strong style={{ marginBottom: "12px", display: "block" }}>
              Tickets with Multiple Problems ({multiProblemAnalyses.length})
            </Body1Strong>

            <Table aria-label="Ticket split analysis results">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Original Ticket</TableHeaderCell>
                  <TableHeaderCell>Secondary Problems</TableHeaderCell>
                  <TableHeaderCell>Reasoning</TableHeaderCell>
                  <TableHeaderCell>Actions</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {multiProblemAnalyses.map((analysis) => (
                  <TableRow key={analysis.original_ticket_id}>
                    <TableCell>
                      <div style={{ maxWidth: "300px" }}>
                        <Body1Strong style={{ display: "block", marginBottom: "4px" }}>
                          {analysis.original_summary}
                        </Body1Strong>
                        <Text size={200} style={{ color: "#666" }}>
                          ID: {analysis.original_ticket_id}
                        </Text>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {analysis.secondary_problems.map((problem, idx) => (
                          <div key={idx}>
                            <Badge
                              appearance="filled"
                              color={getSeverityColor(problem.severity)}
                              style={{ marginRight: "8px" }}
                            >
                              {problem.severity}
                            </Badge>
                            <Badge
                              appearance="outline"
                              color={getPriorityColor(problem.suggested_priority)}
                            >
                              {problem.suggested_priority}
                            </Badge>
                            <Text
                              size={200}
                              style={{ display: "block", marginTop: "4px" }}
                            >
                              {problem.description.substring(0, 100)}
                              {problem.description.length > 100 ? "..." : ""}
                            </Text>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div style={{ maxWidth: "300px" }}>
                        <Text size={200}>{analysis.reasoning}</Text>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger disableButtonEnhancement>
                          <Button
                            appearance="primary"
                            icon={<SplitVerticalRegular />}
                            onClick={() => setSelectedAnalysis(analysis)}
                          >
                            Split
                          </Button>
                        </DialogTrigger>
                        <DialogSurface>
                          <DialogBody>
                            <DialogTitle>Confirm Ticket Split</DialogTitle>
                            <DialogContent>
                              <Body1 style={{ marginBottom: "12px" }}>
                                This will create{" "}
                                <Body1Strong>
                                  {analysis.secondary_problems.length} new ticket(s)
                                </Body1Strong>{" "}
                                for the secondary problems found in:
                              </Body1>
                              <Body1Strong style={{ display: "block", marginBottom: "12px" }}>
                                {analysis.original_summary}
                              </Body1Strong>

                              <div style={{ marginTop: "16px" }}>
                                <Body1Strong>Secondary Problems:</Body1Strong>
                                <ul style={{ marginTop: "8px" }}>
                                  {analysis.secondary_problems.map((problem, idx) => (
                                    <li key={idx} style={{ marginBottom: "8px" }}>
                                      <Badge
                                        appearance="filled"
                                        color={getSeverityColor(problem.severity)}
                                        style={{ marginRight: "8px" }}
                                      >
                                        {problem.severity}
                                      </Badge>
                                      {problem.description}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              <MessageBar
                                intent="warning"
                                style={{ marginTop: "16px" }}
                              >
                                <MessageBarBody>
                                  Note: Split tickets are stored in-memory only and
                                  will be lost on server restart.
                                </MessageBarBody>
                              </MessageBar>
                            </DialogContent>
                            <DialogActions>
                              <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary">Cancel</Button>
                              </DialogTrigger>
                              <Button
                                appearance="primary"
                                onClick={() => handleSplit(analysis)}
                                disabled={splitting}
                              >
                                {splitting ? "Creating..." : "Create Split Tickets"}
                              </Button>
                            </DialogActions>
                          </DialogBody>
                        </DialogSurface>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {!loading && analyses.length > 0 && multiProblemAnalyses.length === 0 && (
        <MessageBar intent="success">
          <MessageBarBody>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckmarkCircleRegular />
              No tickets with multiple problems found! All analyzed tickets
              appear to describe single issues.
            </div>
          </MessageBarBody>
        </MessageBar>
      )}
    </div>
  );
}
