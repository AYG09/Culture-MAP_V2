// src/components/ContextMenu.tsx
import { useState } from 'react';
import './ContextMenu.css';

export interface ContextMenuItem {
  label: string;
  action?: () => void; // children이 있으면 action이 없을 수 있음
  isDanger?: boolean;
  disabled?: boolean; // 비활성화 상태
  children?: ContextMenuItem[]; // 하위 메뉴 항목
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

const MenuItem = ({ item, onClose }: { item: ContextMenuItem; onClose: () => void }) => {
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);

  const handleItemClick = () => {
    if (item.disabled) {
      return; // disabled인 경우 아무 동작 안함
    }

    if (item.action) {
      item.action();
      onClose();
    }
  };

  const handleMouseEnter = () => {
    if (item.children) {
      setIsSubMenuOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (item.children) {
      setIsSubMenuOpen(false);
    }
  };

  return (
    <li
      className={`context-menu-item ${item.isDanger ? 'danger' : ''} ${item.children ? 'has-children' : ''} ${item.disabled ? 'disabled' : ''}`}
      onClick={handleItemClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {item.label}
      {item.children && isSubMenuOpen && (
        <div className="sub-menu">
          <ul>
            {item.children.map((child, index) => (
              <MenuItem key={index} item={child} onClose={onClose} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
};

const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div className="context-menu" style={{ top: y, left: x }}>
        <ul>
          {items.map((item, index) => (
            <MenuItem key={index} item={item} onClose={onClose} />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ContextMenu;
