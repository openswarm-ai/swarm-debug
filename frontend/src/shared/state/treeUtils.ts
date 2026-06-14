import { TreeNodeData, ExpandedState } from '@/types';

export function buildExpandedState(nodes: TreeNodeData[], parentId = ''): ExpandedState {
  const result: ExpandedState = {};
  if (!Array.isArray(nodes)) return result;
  nodes.forEach((node) => {
    const nodeId = parentId ? `${parentId}/${node.name}` : node.name;
    if (node.children && node.children.length > 0) {
      result[nodeId] = true;
      Object.assign(result, buildExpandedState(node.children, nodeId));
    }
  });
  return result;
}

function updateChildrenToggle(
  children: TreeNodeData[] | undefined,
  checked: boolean,
): TreeNodeData[] {
  if (!children) return [];
  return children.map((child) => ({
    ...child,
    is_toggled: checked,
    set_manually: true,
    children: updateChildrenToggle(child.children, checked),
  }));
}

export function recomputeParentToggles(nodes: TreeNodeData[]): TreeNodeData[] {
  return nodes.map((node) => {
    if (!node.children?.length) return node;
    const updated = recomputeParentToggles(node.children);
    return {
      ...node,
      children: updated,
      is_toggled: updated.every((c) => c.is_toggled),
    };
  });
}

export function treeFingerprint(nodes: TreeNodeData[] | null): string {
  if (!nodes) return '';
  const normalized = recomputeParentToggles(nodes);
  const strip = (n: TreeNodeData): object => ({
    n: n.name,
    c: n.color,
    t: n.is_toggled,
    e: n.emoji,
    ...(n.children?.length ? { ch: n.children.map(strip) } : {}),
  });
  return JSON.stringify(normalized.map(strip));
}

function lightenColor(color: string, amt = 50): string {
  if (!color || typeof color !== 'string' || !color.startsWith('#') || color.length !== 7) {
    return '#ffffff';
  }
  const colorInt = parseInt(color.slice(1), 16);
  const r = Math.min(255, (colorInt >> 16) + amt);
  const g = Math.min(255, ((colorInt >> 8) & 0x00ff) + amt);
  const b = Math.min(255, (colorInt & 0x0000ff) + amt);
  return `#${((r << 16) + (g << 8) + b).toString(16).padStart(6, '0')}`;
}

export function toggleTargetNode(
  nodes: TreeNodeData[],
  parts: string[],
  checked: boolean,
): TreeNodeData[] {
  return nodes.map((node) => {
    if (node.name !== parts[0]) return node;
    if (parts.length === 1) {
      return {
        ...node,
        is_toggled: checked,
        set_manually: true,
        children: updateChildrenToggle(node.children, checked),
      };
    }
    return node.children
      ? { ...node, children: toggleTargetNode(node.children, parts.slice(1), checked) }
      : node;
  });
}

export function updateNodeColor(
  nodes: TreeNodeData[],
  parts: string[],
  col: string,
  isOriginalParent = false,
  lightenAmount = 50,
): TreeNodeData[] {
  return nodes.map((node) => {
    if (node.name !== parts[0]) return node;

    let newColor = node.color;
    let setManuallyColor = node.set_manually_color;

    if (parts.length === 1) {
      if (isOriginalParent) setManuallyColor = true;
      newColor = col;
    }

    if (node.children) {
      const updatedChildren = updateNodeColor(
        node.children,
        parts.slice(1),
        col,
        isOriginalParent,
        lightenAmount,
      );
      const propagatedChildren = updatedChildren.map((child) => {
        if (!child.set_manually_color) {
          const newPath = [...parts.slice(1), child.name];
          return updateNodeColor(
            [child],
            newPath,
            lightenColor(col, lightenAmount),
            false,
            lightenAmount,
          )[0];
        }
        return child;
      });
      return {
        ...node,
        color: newColor,
        is_toggled: node.is_toggled,
        set_manually_color: setManuallyColor,
        children: propagatedChildren,
      };
    }

    return { ...node, color: newColor, is_toggled: node.is_toggled, set_manually_color: setManuallyColor };
  });
}

function propagateEmoji(node: TreeNodeData, emoji: string): TreeNodeData {
  if (!node.children) return node;
  const updatedChildren = node.children.map((child) => {
    if (child.set_manually_emoji) return child;
    return {
      ...child,
      emoji,
      children: propagateEmoji(child, emoji).children,
    };
  });
  return { ...node, children: updatedChildren };
}

export function updateNodeEmoji(
  nodes: TreeNodeData[],
  parts: string[],
  emoji: string,
): TreeNodeData[] {
  return nodes.map((node) => {
    if (node.name !== parts[0]) return node;

    let updatedNode = { ...node };
    if (parts.length === 1) {
      updatedNode.emoji = emoji;
      updatedNode.set_manually_emoji = true;
    }
    if (node.children && parts.length > 1) {
      updatedNode = {
        ...updatedNode,
        children: updateNodeEmoji(node.children, parts.slice(1), emoji),
      };
    }
    if (parts.length === 1 && node.children) {
      updatedNode.children = propagateEmoji(updatedNode, emoji).children;
    }
    return updatedNode;
  });
}
