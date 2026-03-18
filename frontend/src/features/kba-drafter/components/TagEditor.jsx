import React, { useState } from "react";
import {
  Button,
  Input,
  Tag,
  TagGroup,
  Label,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Dismiss24Regular,
} from "@fluentui/react-icons";

/**
 * TagEditor - Component for editing tags (keywords)
 * 
 * Features:
 * - Add new tags
 * - Remove tags with X button
 * - Display as Fluent UI TagGroup
 * - Prevent duplicate tags
 * 
 * @param {Object} props
 * @param {string[]} props.tags - Array of tag strings
 * @param {Function} props.onChange - Callback(newTags) when tags change
 * @param {string} props.label - Label for the tag editor
 */
export default function TagEditor({ tags = [], onChange, label = "Tags" }) {
  const [newTagValue, setNewTagValue] = useState("");

  const handleAddTag = () => {
    const trimmed = newTagValue.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setNewTagValue("");
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    onChange(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {label && <Label weight="semibold">{label}</Label>}
      
      {/* Display tags */}
      {tags.length > 0 && (
        <TagGroup>
          {tags.map((tag, index) => (
            <Tag
              key={index}
              size="small"
              dismissible
              dismissIcon={{ onClick: () => handleRemoveTag(tag) }}
            >
              {tag}
            </Tag>
          ))}
        </TagGroup>
      )}
      
      {/* Add new tag input */}
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <Input
          value={newTagValue}
          onChange={(e) => setNewTagValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Neuer Tag..."
          style={{ flex: 1, width: "100%" }}
        />
        <Button
          appearance="outline"
          icon={<Add24Regular />}
          onClick={handleAddTag}
          disabled={!newTagValue.trim()}
          size="small"
        >
          Hinzufügen
        </Button>
      </div>
    </div>
  );
}
