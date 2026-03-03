import React from "react";
import {
  Button,
  Input,
  Textarea,
  Label,
} from "@fluentui/react-components";
import {
  Add24Regular,
  Delete24Regular,
  ArrowUp24Regular,
  ArrowDown24Regular,
} from "@fluentui/react-icons";

/**
 * EditableList - Reusable component for editing lists of strings
 * 
 * Features:
 * - Add/remove items
 * - Edit items inline
 * - Optional multiline support (textarea)
 * - Optional reorder capability
 * 
 * @param {Object} props
 * @param {string[]} props.items - Array of string items
 * @param {Function} props.onChange - Callback(newItems) when list changes
 * @param {string} props.label - Label for the list
 * @param {string} props.itemLabel - Singular label (e.g., "Symptom", "Schritt")
 * @param {boolean} props.multiline - Use textarea instead of input
 * @param {boolean} props.allowReorder - Show up/down buttons
 * @param {string} props.placeholder - Placeholder for empty items
 */
export default function EditableList({
  items = [],
  onChange,
  label,
  itemLabel = "Item",
  multiline = false,
  allowReorder = false,
  placeholder = "",
}) {
  const handleItemChange = (index, value) => {
    const newItems = [...items];
    newItems[index] = value;
    onChange(newItems);
  };

  const handleAddItem = () => {
    onChange([...items, ""]);
  };

  const handleRemoveItem = (index) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    onChange(newItems);
  };

  const handleMoveDown = (index) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    onChange(newItems);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {label && <Label weight="semibold">{label}</Label>}
      
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            gap: "8px",
            alignItems: multiline ? "flex-start" : "center",
          }}
        >
          <div style={{ flex: 1, width: "100%" }}>
            {multiline ? (
              <Textarea
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                placeholder={placeholder || `${itemLabel} ${index + 1}`}
                rows={3}
                style={{ width: "100%" }}
              />
            ) : (
              <Input
                value={item}
                onChange={(e) => handleItemChange(index, e.target.value)}
                placeholder={placeholder || `${itemLabel} ${index + 1}`}
                style={{ width: "100%" }}
              />
            )}
          </div>
          
          <div style={{ display: "flex", gap: "4px" }}>
            {allowReorder && (
              <>
                <Button
                  appearance="subtle"
                  icon={<ArrowUp24Regular />}
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  size="small"
                  title="Nach oben"
                />
                <Button
                  appearance="subtle"
                  icon={<ArrowDown24Regular />}
                  onClick={() => handleMoveDown(index)}
                  disabled={index === items.length - 1}
                  size="small"
                  title="Nach unten"
                />
              </>
            )}
            <Button
              appearance="subtle"
              icon={<Delete24Regular />}
              onClick={() => handleRemoveItem(index)}
              size="small"
              title="Entfernen"
            />
          </div>
        </div>
      ))}
      
      <Button
        appearance="outline"
        icon={<Add24Regular />}
        onClick={handleAddItem}
        size="small"
      >
        {itemLabel} hinzufügen
      </Button>
    </div>
  );
}
