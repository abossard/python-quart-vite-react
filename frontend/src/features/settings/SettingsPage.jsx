/**
 * SettingsPage — Menu customization: hide/show, drag-and-drop reorder, icon picker.
 *
 * Receives tabPrefs from App.jsx via props so changes are reflected live in the nav bar.
 */

import {
  Body1,
  Button,
  Card,
  Caption1,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  Subtitle2,
  Switch,
  Text,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowReset24Regular,
  ReOrder24Regular,
  Color24Regular,
} from '@fluentui/react-icons'
import { createElement, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ICON_MAP, ICON_NAMES } from './iconMap'

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    maxWidth: '800px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortableItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    marginBottom: '4px',
    cursor: 'grab',
    userSelect: 'none',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  dragging: {
    opacity: 0.5,
    boxShadow: tokens.shadow8,
  },
  dragHandle: {
    color: tokens.colorNeutralForeground4,
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
  },
  tabLabel: {
    flex: 1,
    fontWeight: tokens.fontWeightSemibold,
  },
  tabPath: {
    color: tokens.colorNeutralForeground4,
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  iconBtn: {
    minWidth: '32px',
    width: '32px',
    height: '32px',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  iconGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gap: '4px',
    maxHeight: '300px',
    overflowY: 'auto',
    padding: tokens.spacingVerticalS,
  },
  iconGridItem: {
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: tokens.borderRadiusMedium,
    cursor: 'pointer',
    border: '2px solid transparent',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      border: `2px solid ${tokens.colorBrandStroke1}`,
    },
  },
  iconGridItemSelected: {
    backgroundColor: tokens.colorBrandBackground2,
    border: `2px solid ${tokens.colorBrandStroke1}`,
  },
  hiddenRow: {
    opacity: 0.5,
  },
})

function IconPicker({ currentIconName, onSelect }) {
  const styles = useStyles()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={(_, data) => setOpen(data.open)} trapFocus>
      <PopoverTrigger>
        <Tooltip content="Change icon" relationship="label">
          <button className={styles.iconBtn} data-testid="icon-picker-trigger" aria-label="Change icon">
            {currentIconName && ICON_MAP[currentIconName]
              ? createElement(ICON_MAP[currentIconName])
              : <Color24Regular />}
          </button>
        </Tooltip>
      </PopoverTrigger>
      <PopoverSurface>
        <Caption1 style={{ marginBottom: '8px', display: 'block' }}>Pick an icon</Caption1>
        <div className={styles.iconGrid} data-testid="icon-grid">
          {ICON_NAMES.map((name) => (
            <Tooltip key={name} content={name.replace('24Regular', '')} relationship="label">
              <div
                className={`${styles.iconGridItem} ${currentIconName === name ? styles.iconGridItemSelected : ''}`}
                onClick={() => { onSelect(name); setOpen(false) }}
                data-testid={`icon-option-${name}`}
              >
                {createElement(ICON_MAP[name])}
              </div>
            </Tooltip>
          ))}
        </div>
      </PopoverSurface>
    </Popover>
  )
}

function SortableTabRow({ tab, isHidden, onToggle, iconOverride, onIconSelect }) {
  const styles = useStyles()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.value })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.sortableItem} ${isDragging ? styles.dragging : ''} ${isHidden ? styles.hiddenRow : ''}`}
      data-testid={`settings-tab-${tab.value}`}
    >
      <div className={styles.dragHandle} {...attributes} {...listeners} data-testid="drag-handle">
        <ReOrder24Regular />
      </div>

      <IconPicker
        currentIconName={iconOverride || tab.defaultIconName}
        onSelect={(name) => onIconSelect(tab.value, name)}
      />

      <div style={{ flex: 1 }}>
        <Text className={styles.tabLabel}>{tab.label}</Text>
        <div className={styles.tabPath}>{tab.path}</div>
      </div>

      <Switch
        checked={!isHidden}
        onChange={() => onToggle(tab.value)}
        label={isHidden ? 'Hidden' : 'Visible'}
        data-testid={`toggle-${tab.value}`}
      />
    </div>
  )
}

export default function SettingsPage({ tabPrefs }) {
  const styles = useStyles()
  const { allTabs, hidden, icons, toggleHidden, setOrder, setIcon, resetAll } = tabPrefs

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Compute ordered list for DnD (respecting current order pref)
  const orderedTabs = (() => {
    const currentOrder = tabPrefs.order || []
    if (currentOrder.length === 0) return allTabs
    return [...allTabs].sort((a, b) => {
      const ai = currentOrder.indexOf(a.value)
      const bi = currentOrder.indexOf(b.value)
      if (ai === -1 && bi === -1) return 0
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  })()

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = orderedTabs.findIndex((t) => t.value === active.id)
    const newIndex = orderedTabs.findIndex((t) => t.value === over.id)
    const reordered = arrayMove(orderedTabs, oldIndex, newIndex)
    setOrder(reordered.map((t) => t.value))
  }

  return (
    <div className={styles.container} data-testid="settings-page">
      <div className={styles.header}>
        <div>
          <Subtitle2>Menu Settings</Subtitle2>
          <Caption1 style={{ display: 'block', marginTop: '4px' }}>
            Drag to reorder, toggle visibility, or change icons
          </Caption1>
        </div>
        <Button
          appearance="subtle"
          icon={<ArrowReset24Regular />}
          onClick={resetAll}
          data-testid="settings-reset"
        >
          Reset to defaults
        </Button>
      </div>

      <Card>
        <div style={{ padding: tokens.spacingVerticalS }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedTabs.map((t) => t.value)} strategy={verticalListSortingStrategy}>
              {orderedTabs.map((tab) => (
                <SortableTabRow
                  key={tab.value}
                  tab={tab}
                  isHidden={hidden.includes(tab.value)}
                  onToggle={toggleHidden}
                  iconOverride={icons[tab.value]}
                  onIconSelect={setIcon}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </Card>

      <Caption1>
        {hidden.length === 0
          ? 'All tabs visible'
          : `${hidden.length} tab${hidden.length > 1 ? 's' : ''} hidden`}
        {' · '}Changes are saved automatically
      </Caption1>
    </div>
  )
}
