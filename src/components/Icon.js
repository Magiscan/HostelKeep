import React from 'react';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LayoutGrid,
  Building2,
  Users,
  ArrowRightLeft,
  Search,
  XCircle,
  RefreshCw,
  Pencil,
  Key,
  Globe,
  LogOut,
  ChevronUp,
  ChevronDown,
  Check,
  CheckCircle,
  PlusCircle,
  Layers,
  SlidersHorizontal,
  Download,
  MoreVertical,
  PenLine,
  Trash2,
  Hourglass,
  Send,
  AlarmClock,
  Clock,
  BedDouble,
  Home,
  UserX,
  Circle,
  Zap,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCheck,
  Calendar,
  Printer,
  Flag,
  FileText,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  X,
} from 'lucide-react';

// Map Ionicons names → Lucide components (web only)
const WEB_ICON_MAP = {
  'grid-outline': LayoutGrid,
  'grid': LayoutGrid,
  'construct-outline': Building2,
  'construct': Building2,
  'people-outline': Users,
  'people': Users,
  'swap-horizontal-outline': ArrowRightLeft,
  'swap-horizontal': ArrowRightLeft,
  'search-outline': Search,
  'close-circle': XCircle,
  'close-circle-outline': XCircle,
  'refresh': RefreshCw,
  'refresh-circle': RefreshCw,
  'pencil': Pencil,
  'key-outline': Key,
  'globe-outline': Globe,
  'log-out-outline': LogOut,
  'chevron-up': ChevronUp,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-back': ArrowLeft,
  'arrow-forward': ArrowRight,
  'checkmark': Check,
  'checkmark-circle': CheckCircle,
  'add-circle-outline': PlusCircle,
  'layers-outline': Layers,
  'options-outline': SlidersHorizontal,
  'download-outline': Download,
  'ellipsis-vertical': MoreVertical,
  'create-outline': PenLine,
  'trash-outline': Trash2,
  'hourglass-outline': Hourglass,
  'send-outline': Send,
  'alarm-outline': AlarmClock,
  'time-outline': Clock,
  'bed-outline': BedDouble,
  'home-outline': Home,
  'person-remove-outline': UserX,
  'ellipse-outline': Circle,
  'flash-outline': Zap,
  'eye-outline': Eye,
  'eye-off-outline': EyeOff,
  'alert-circle': AlertCircle,
  'checkmark-done-outline': CheckCheck,
  'calendar-outline': Calendar,
  'print-outline': Printer,
  'flag-outline': Flag,
  'document-text-outline': FileText,
  'notifications-outline': Bell,
  'settings-outline': Settings,
  'close': X,
};

export default function Icon({ name, size = 20, color, style }) {
  if (Platform.OS === 'web') {
    const LucideIcon = WEB_ICON_MAP[name];
    if (LucideIcon) {
      // Lucide icons accept size and color as props
      return <LucideIcon size={size} color={color || 'currentColor'} style={style} />;
    }
    // Fallback to a simple circle if name not found
    return <Circle size={size} color={color || 'currentColor'} style={style} />;
  }

  // Native: use Ionicons
  return <Ionicons name={name} size={size} color={color} style={style} />;
}