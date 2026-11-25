import {
  ChartDrawing,
  DrawingCategoryId,
  DrawingTemplate,
  DrawingTemplateConfig,
  DrawingTool,
} from '../types/market';
import { DEFAULT_FIB_LEVELS, getDrawingToolDef } from './drawingToolsCatalog';

export interface ToolCapabilities {
  hasLineStyle: boolean;
  hasFill: boolean;
  hasExtend: boolean;
  hasText: boolean;
  hasFibLevels: boolean;
  isPosition: boolean;
  hasTable: boolean;
}

const FILLABLE_TOOLS = new Set<Exclude<DrawingTool, 'cursor'>>([
  'parallel_channel',
  'regression_trend',
  'flat_top_bottom',
  'disjoint_channel',
  'pitchfork',
  'schiff_pitchfork',
  'modified_schiff_pitchfork',
  'gann_box',
  'gann_square',
  'gann_square_fixed',
  'rectangle',
  'rotated_rectangle',
  'circle',
  'ellipse',
  'polyline',
  'triangle',
  'price_range',
  'date_range',
  'date_price_range',
  'measure',
]);

const TEXT_TOOLS = new Set<Exclude<DrawingTool, 'cursor'>>([
  'text',
  'note',
  'price_note',
  'callout',
  'comment',
  'price_label',
  'signpost',
  'image',
]);

export function getToolCapabilities(
  tool: Exclude<DrawingTool, 'cursor'>,
  category: DrawingCategoryId
): ToolCapabilities {
  const isPosition = tool === 'long_position' || tool === 'short_position';
  return {
    hasLineStyle: !TEXT_TOOLS.has(tool) || tool === 'callout' || tool === 'price_note',
    hasFill: FILLABLE_TOOLS.has(tool),
    hasExtend:
      category === 'lines' ||
      category === 'channels' ||
      tool === 'fib_channel',
    hasText: TEXT_TOOLS.has(tool),
    hasFibLevels: category === 'fibonacci',
    isPosition,
    hasTable: tool === 'table',
  };
}

export const DEFAULT_DRAWING_TEMPLATES: DrawingTemplate[] = [
  {
    id: 'tpl-sys-trendline-std',
    name: 'Standard Trendline',
    tool: 'trendline',
    category: 'lines',
    isSystemDefault: true,
    isDefaultForTool: true,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
    config: {
      color: '#2962FF',
      lineWidth: 1.5,
      lineStyle: 'solid',
      opacity: 1,
      extendLeft: false,
      extendRight: false,
    },
  },
  {
    id: 'tpl-sys-trendline-gold',
    name: 'Gold Resistance Line',
    tool: 'trendline',
    category: 'lines',
    isSystemDefault: true,
    isDefaultForTool: false,
    createdAt: '2026-01-12',
    updatedAt: '2026-01-12',
    config: {
      color: '#F0B90B',
      lineWidth: 3,
      lineStyle: 'dashed',
      opacity: 0.95,
      extendLeft: false,
      extendRight: true,
    },
  },
  {
    id: 'tpl-sys-horizontal-support',
    name: 'Institutional Support Level',
    tool: 'horizontal',
    category: 'lines',
    isSystemDefault: true,
    isDefaultForTool: true,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
    config: {
      color: '#089981',
      lineWidth: 2,
      lineStyle: 'dashed',
      opacity: 0.9,
    },
  },
  {
    id: 'tpl-sys-rectangle-demand',
    name: 'Supply / Demand Zone',
    tool: 'rectangle',
    category: 'shapes',
    isSystemDefault: true,
    isDefaultForTool: true,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
    config: {
      color: '#2962FF',
      fillColor: '#2962FF',
      fillOpacity: 0.16,
      lineWidth: 1.5,
      lineStyle: 'solid',
      opacity: 1,
    },
  },
  {
    id: 'tpl-sys-fib-golden',
    name: 'Golden Pocket Retracement',
    tool: 'fibonacci',
    category: 'fibonacci',
    isSystemDefault: true,
    isDefaultForTool: true,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
    config: {
      color: '#F0B90B',
      lineWidth: 1.5,
      lineStyle: 'solid',
      opacity: 0.95,
      showLabels: true,
      fibLevels: DEFAULT_FIB_LEVELS.map((l) => ({ ...l })),
    },
  },
  {
    id: 'tpl-sys-long-std',
    name: 'Institutional Long Setup',
    tool: 'long_position',
    category: 'forecasting',
    isSystemDefault: true,
    isDefaultForTool: true,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
    config: {
      color: '#089981',
      lineWidth: 1.5,
      lineStyle: 'solid',
      opacity: 0.9,
      positionStyle: {
        profitColor: '#089981',
        lossColor: '#F23645',
        entryColor: '#2962FF',
      },
    },
  },
  {
    id: 'tpl-sys-short-std',
    name: 'Institutional Short Setup',
    tool: 'short_position',
    category: 'forecasting',
    isSystemDefault: true,
    isDefaultForTool: true,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
    config: {
      color: '#F23645',
      lineWidth: 1.5,
      lineStyle: 'solid',
      opacity: 0.9,
      positionStyle: {
        profitColor: '#089981',
        lossColor: '#F23645',
        entryColor: '#2962FF',
      },
    },
  },
  {
    id: 'tpl-sys-text-note',
    name: 'Clean Desk Annotation',
    tool: 'text',
    category: 'annotations',
    isSystemDefault: true,
    isDefaultForTool: true,
    createdAt: '2026-01-10',
    updatedAt: '2026-01-10',
    config: {
      color: '#D1D4DC',
      textColor: '#D1D4DC',
      backgroundColor: '#1E222D',
      borderColor: '#2A2E39',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 12,
      textAlign: 'left',
      lineWidth: 1.5,
      lineStyle: 'solid',
      opacity: 1,
    },
  },
];

export function extractTemplateConfigFromDrawing(d: ChartDrawing): DrawingTemplateConfig {
  return {
    color: d.color,
    fillColor: d.fillColor,
    fillOpacity: d.fillOpacity,
    textColor: d.textColor,
    lineWidth: d.lineWidth,
    lineStyle: d.lineStyle,
    opacity: d.opacity,
    fontFamily: d.fontFamily,
    fontSize: d.fontSize,
    textAlign: d.textAlign,
    backgroundColor: d.backgroundColor,
    borderColor: d.borderColor,
    extendLeft: d.extendLeft,
    extendRight: d.extendRight,
    showLabels: d.showLabels,
    fibLevels: d.fibLevels ? d.fibLevels.map((l) => ({ ...l })) : undefined,
    visibleIntervals: d.visibleIntervals ? [...d.visibleIntervals] : undefined,
    positionStyle: d.positionData
      ? {
          profitColor: d.positionData.profitColor,
          lossColor: d.positionData.lossColor,
          entryColor: d.positionData.entryColor,
          positionSize: d.positionData.positionSize,
        }
      : undefined,
  };
}

export function getDefaultConfigForTool(
  tool: Exclude<DrawingTool, 'cursor'>,
  templates: DrawingTemplate[]
): DrawingTemplateConfig {
  const defaultTpl =
    templates.find((t) => t.tool === tool && t.isDefaultForTool) ??
    templates.find((t) => t.tool === tool);

  if (defaultTpl) {
    return {
      ...defaultTpl.config,
      fibLevels: defaultTpl.config.fibLevels?.map((l) => ({ ...l })),
      visibleIntervals: defaultTpl.config.visibleIntervals
        ? [...defaultTpl.config.visibleIntervals]
        : undefined,
      positionStyle: defaultTpl.config.positionStyle
        ? { ...defaultTpl.config.positionStyle }
        : undefined,
    };
  }

  const def = getDrawingToolDef(tool);
  return {
    color: def?.defaultColor ?? '#2962FF',
    fillColor: def?.defaultColor ?? '#2962FF',
    fillOpacity: 0.16,
    textColor: def?.defaultColor ?? '#D1D4DC',
    lineWidth: 1.5,
    lineStyle: 'solid',
    opacity: 1,
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 12,
    textAlign: 'left',
    showLabels: true,
    fibLevels:
      def?.category === 'fibonacci'
        ? DEFAULT_FIB_LEVELS.map((l) => ({ ...l }))
        : undefined,
    positionStyle:
      tool === 'long_position' || tool === 'short_position'
        ? {
            profitColor: '#089981',
            lossColor: '#F23645',
            entryColor: '#2962FF',
          }
        : undefined,
  };
}

export function applyTemplateConfigToDrawing(
  drawing: ChartDrawing,
  config: DrawingTemplateConfig
): Partial<ChartDrawing> {
  const patch: Partial<ChartDrawing> = {
    color: config.color,
    fillColor: config.fillColor ?? config.color,
    fillOpacity: config.fillOpacity,
    textColor: config.textColor,
    lineWidth: config.lineWidth,
    lineStyle: config.lineStyle,
    opacity: config.opacity,
    fontFamily: config.fontFamily,
    fontSize: config.fontSize,
    textAlign: config.textAlign,
    backgroundColor: config.backgroundColor,
    borderColor: config.borderColor,
    extendLeft: config.extendLeft,
    extendRight: config.extendRight,
    showLabels: config.showLabels,
    visibleIntervals: config.visibleIntervals ? [...config.visibleIntervals] : drawing.visibleIntervals,
    fibLevels: config.fibLevels ? config.fibLevels.map((l) => ({ ...l })) : drawing.fibLevels,
  };

  if (drawing.positionData && config.positionStyle) {
    patch.positionData = {
      ...drawing.positionData,
      profitColor: config.positionStyle.profitColor,
      lossColor: config.positionStyle.lossColor,
      entryColor: config.positionStyle.entryColor,
      positionSize:
        config.positionStyle.positionSize !== undefined
          ? config.positionStyle.positionSize
          : drawing.positionData.positionSize,
    };
  }

  return patch;
}
