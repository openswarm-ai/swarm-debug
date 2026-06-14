import React, { useState, useContext } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Checkbox from '@mui/material/Checkbox';
import Tooltip from '@mui/material/Tooltip';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import InvertColorsIcon from '@mui/icons-material/InvertColors';
import { motion } from 'framer-motion';
import { useClaudeTokens, useThemeMode } from '@/shared/styles/ThemeContext';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import { toggleExpanded, checkboxChange, colorChange } from '@/shared/state/debuggerSlice';
import { adaptColorForMode } from '@/shared/state/treeUtils';
import EmojiPicker from '@/app/components/EmojiPicker/EmojiPicker';
import { TreeNodeData } from '@/types';
import { TreeHoverContext } from '@/app/components/Tree/TreeHoverContext';
import ColorPickerPopup from '@/app/components/Tree/ColorPickerPopup';

function hasAnyToggledDescendant(node: TreeNodeData): boolean {
  if (!node.children) return false;
  return node.children.some((c) => c.is_toggled || hasAnyToggledDescendant(c));
}

interface TreeNodeProps {
  node: TreeNodeData;
  nodeId: string;
  renderTree: (node: TreeNodeData, parentId: string, index: number, depth: number) => React.ReactNode;
  index: number;
  depth: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, nodeId, renderTree, index, depth }) => {
  const c = useClaudeTokens();
  const { mode } = useThemeMode();
  const dispatch = useAppDispatch();
  const nodeColor = node.color ? adaptColorForMode(node.color, mode) : null;
  const isExpanded = useAppSelector((s) => s.debugger.expanded[nodeId]);
  const isDirectory = node.children && node.children.length > 0;
  const indeterminate = !!isDirectory && !node.is_toggled && hasAnyToggledDescendant(node);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { hoveredNodeId, onNodeHover } = useContext(TreeHoverContext);
  const showAccentBar = isDirectory && isExpanded && hoveredNodeId !== null &&
    (hoveredNodeId === nodeId || nodeId.startsWith(hoveredNodeId + '/'));

  const handleRowClick = (e: React.MouseEvent) => {
    if (!isDirectory) return;
    if ((e.target as HTMLElement).closest('[data-no-row-click]')) return;
    dispatch(toggleExpanded(nodeId));
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
    >
      <Box
        sx={{ width: '100%' }}
        onMouseOver={(e: React.MouseEvent) => { e.stopPropagation(); onNodeHover(isDirectory ? nodeId : null); }}
      >
        <Box
          onClick={handleRowClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.25,
            py: 0.625,
            borderRadius: `${c.radius.md}px`,
            cursor: isDirectory ? 'pointer' : 'default',
            minHeight: 36,
            transition: c.transition,
            '&:hover': { bgcolor: c.bg.elevated },
            '&:hover .checkbox-reveal': { opacity: 1 },
            '&:hover .color-picker-reveal': { opacity: 0.7 },
          }}
        >
          <Box
            data-no-row-click
            className="checkbox-reveal"
            sx={{
              opacity: node.is_toggled ? 0.3 : 0.6,
              transition: c.transition,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Checkbox
              checked={node.is_toggled}
              indeterminate={indeterminate}
              onChange={(e) => dispatch(checkboxChange({ nodeId, checked: e.target.checked }))}
              size="small"
              sx={{
                p: 0,
                color: c.text.tertiary,
                '&.Mui-checked': { color: c.accent.primary },
                '&.MuiCheckbox-indeterminate': { color: c.accent.primary },
              }}
            />
          </Box>

          <Box data-no-row-click sx={{ ml: depth * 3 }}>
            <EmojiPicker
              defaultEmoji={node.emoji}
              handleEmojiChange={(emoji: string) =>
                dispatch({ type: 'debugger/emojiChange', payload: { nodeId, emoji } })
              }
            />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 0.5, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '0.875rem',
                fontFamily: c.font.mono,
                fontWeight: isDirectory ? 600 : 400,
                color: nodeColor || c.text.primary,
                opacity: (node.is_toggled || indeterminate) ? 1 : 0.38,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: c.transition,
              }}
            >
              {node.name}
            </Typography>
            <Box data-no-row-click sx={{ position: 'relative' }}>
              <Tooltip title="Change color">
                <IconButton
                  size="small"
                  className="color-picker-reveal"
                  onClick={() => setShowColorPicker((prev) => !prev)}
                  sx={{
                    color: nodeColor || c.text.tertiary,
                    opacity: 0,
                    '&:focus': { opacity: 0.7 },
                    '&:hover': { color: c.accent.primary, opacity: 1 },
                    transition: c.transition,
                    p: 0.25,
                  }}
                >
                  <InvertColorsIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              {showColorPicker && (
                <ColorPickerPopup
                  color={node.color || c.text.primary}
                  onChange={(col: string) => dispatch(colorChange({ nodeId, color: col }))}
                  onClose={() => setShowColorPicker(false)}
                />
              )}
            </Box>
          </Box>

          {isDirectory && (
            <ChevronRightIcon
              sx={{
                fontSize: 18,
                color: c.text.tertiary,
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 200ms ease',
                flexShrink: 0,
              }}
            />
          )}
        </Box>

        {isDirectory && isExpanded && (
          <Box sx={{ position: 'relative' }}>
            <Box
              sx={{
                position: 'absolute',
                left: `${50 + depth * 24}px`,
                top: 0,
                bottom: 0,
                width: 2,
                borderRadius: 1,
                bgcolor: c.accent.primary,
                opacity: showAccentBar ? 0.4 : 0,
                transition: 'opacity 200ms ease',
                pointerEvents: 'none',
              }}
            />
            {node.children!.map((childNode, childIndex) => renderTree(childNode, nodeId, childIndex, depth + 1))}
          </Box>
        )}
      </Box>
    </motion.div>
  );
};

export default TreeNode;
