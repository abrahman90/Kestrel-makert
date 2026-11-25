export type MarketCategory = 'All' | 'Forex' | 'Crypto' | 'Stocks' | 'Indices' | 'Commodities';

export type NavSection =
  | 'overview'
  | 'charts'
  | 'markets'
  | 'screener'
  | 'watchlists'
  | 'technical'
  | 'alerts'
  | 'portfolio'
  | 'trading'
  | 'news'
  | 'calendar'
  | 'reports'
  | 'admin'
  | 'settings';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1D' | '1W' | '1M';

export type ChartStyle = 'candles' | 'hollow' | 'line' | 'area' | 'heikin_ashi';

export type DrawingCategoryId =
  | 'lines'
  | 'channels'
  | 'pitchforks'
  | 'fibonacci'
  | 'gann'
  | 'forecasting'
  | 'volume'
  | 'measurement'
  | 'shapes'
  | 'annotations';

export type DrawingTool =
  | 'cursor'
  // Category A: Lines
  | 'trendline'
  | 'ray'
  | 'info_line'
  | 'extended_line'
  | 'trend_angle'
  | 'horizontal'
  | 'horizontal_ray'
  | 'vertical'
  | 'cross_line'
  // Category B: Channels
  | 'parallel_channel'
  | 'regression_trend'
  | 'flat_top_bottom'
  | 'disjoint_channel'
  // Category C: Pitchforks
  | 'pitchfork'
  | 'schiff_pitchfork'
  | 'modified_schiff_pitchfork'
  // Category D: Fibonacci Tools
  | 'fibonacci'
  | 'fib_extension'
  | 'fib_channel'
  | 'fib_time_zone'
  | 'fib_speed_resistance'
  | 'trend_fib_time'
  | 'fib_circles'
  | 'fib_spirals'
  | 'fib_wedge'
  | 'fib_fan'
  // Category E: Gann Tools
  | 'gann_box'
  | 'gann_square'
  | 'gann_square_fixed'
  // Category F: Forecasting & Measurement
  | 'long_position'
  | 'short_position'
  | 'bar_pattern'
  | 'ghost_feed'
  | 'projection'
  | 'date_price_range'
  // Category G: Volume-Based Tools
  | 'anchored_vwap'
  | 'fixed_range_vp'
  | 'anchored_vp'
  // Category H: Measurement Tools
  | 'price_range'
  | 'date_range'
  | 'measure'
  // Category I: Geometric Shapes
  | 'brush'
  | 'highlighter'
  | 'arrow_marker'
  | 'arrow'
  | 'arrow_up'
  | 'arrow_down'
  | 'rectangle'
  | 'rotated_rectangle'
  | 'path'
  | 'circle'
  | 'ellipse'
  | 'polyline'
  | 'triangle'
  | 'arc'
  // Category J: Annotation & Text Tools
  | 'text'
  | 'note'
  | 'price_note'
  | 'pin'
  | 'table'
  | 'callout'
  | 'comment'
  | 'price_label'
  | 'signpost'
  | 'flag_mark'
  | 'image';

export type LineStyle = 'solid' | 'dashed' | 'dotted';
export type TextAlign = 'left' | 'center' | 'right';

export interface FibLevelConfig {
  ratio: number;
  enabled: boolean;
  color: string;
}

export interface PositionDrawingData {
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  startIndex: number;
  endIndex: number;
  positionSize: number;
  profitColor: string;
  lossColor: string;
  entryColor: string;
}

export interface ChartDrawing {
  id: string;
  symbol: string;
  tool: Exclude<DrawingTool, 'cursor'>;
  category: DrawingCategoryId;
  name: string;
  groupName: string;
  points: { index: number; price: number }[];
  color: string;
  fillColor?: string;
  fillOpacity?: number;
  textColor?: string;
  lineWidth: number;
  lineStyle: LineStyle;
  opacity: number; // 0.1 - 1
  fontFamily?: string;
  fontSize?: number;
  textAlign?: TextAlign;
  backgroundColor?: string;
  borderColor?: string;
  extendLeft?: boolean;
  extendRight?: boolean;
  visible: boolean;
  visibleIntervals?: Timeframe[];
  locked: boolean;
  text?: string;
  showLabels?: boolean;
  fibLevels?: FibLevelConfig[];
  tableRows?: string[][];
  positionData?: PositionDrawingData;
}

export interface DrawingTemplateConfig {
  color: string;
  fillColor?: string;
  fillOpacity?: number;
  textColor?: string;
  lineWidth: number;
  lineStyle: LineStyle;
  opacity: number;
  fontFamily?: string;
  fontSize?: number;
  textAlign?: TextAlign;
  backgroundColor?: string;
  borderColor?: string;
  extendLeft?: boolean;
  extendRight?: boolean;
  showLabels?: boolean;
  fibLevels?: FibLevelConfig[];
  visibleIntervals?: Timeframe[];
  positionStyle?: {
    profitColor: string;
    lossColor: string;
    entryColor: string;
    positionSize?: number;
  };
}

export interface DrawingTemplate {
  id: string;
  name: string;
  tool: Exclude<DrawingTool, 'cursor'>;
  category: DrawingCategoryId;
  isSystemDefault?: boolean;
  isDefaultForTool?: boolean;
  createdAt: string;
  updatedAt: string;
  config: DrawingTemplateConfig;
}

export interface Candle {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Instrument {
  symbol: string;
  name: string;
  exchange: string;
  category: Exclude<MarketCategory, 'All'>;
  price: number;
  prevClose: number;
  change: number;
  changePercent: number;
  high24h: number;
  low24h: number;
  high52w: number;
  low52w: number;
  bid: number;
  ask: number;
  spread: string;
  volume24h: number;
  volumeLabel: string;
  marketCap?: number; // USD billions if applicable
  marketCapLabel?: string;
  decimals: number;
  status: 'Open' | 'Extended' | 'Closed' | '24/7';
  rsi14: number;
  maSignal: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  sectorOrBase: string;
  sparkline: number[];
}

export type IndicatorId =
  | 'volume'
  | 'ema20'
  | 'ema50'
  | 'sma200'
  | 'bb'
  | 'keltner'
  | 'ichimoku'
  | 'vp'
  | 'rsi'
  | 'macd'
  | 'stoch'
  | 'cci'
  | 'atr'
  | 'obv';

export type IndicatorGroup = 'Trend' | 'Momentum' | 'Volume' | 'Volatility';

export interface IndicatorConfig {
  id: IndicatorId;
  label: string;
  shortName: string;
  category: 'Overlay' | 'Oscillator';
  group: IndicatorGroup;
  enabled: boolean;
  color: string;
  params: Record<string, number>;
}

export interface WatchlistGroup {
  id: string;
  name: string;
  symbols: string[];
}

export type AlertCondition = 'Crossing' | 'Crossing Up' | 'Crossing Down' | 'Greater Than' | 'Less Than';

export type AlertStatus = 'Active' | 'Triggered' | 'Expired';

export interface PriceAlert {
  id: string;
  symbol: string;
  condition: AlertCondition;
  targetPrice: number;
  currentPriceAtCreate: number;
  notificationMethod: ('In-App' | 'Email' | 'Webhook')[];
  status: AlertStatus;
  createdAt: string;
  triggeredAt?: string;
  expiresAt: string;
  note?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string[];
  category: Exclude<MarketCategory, 'All'> | 'Macro';
  source: string;
  author: string;
  publishedAt: string;
  readTime: string;
  relatedSymbols: string[];
  imageUrl?: string;
  sentiment: 'Bullish' | 'Bearish' | 'Neutral';
}

export type ImpactLevel = 'Low' | 'Medium' | 'High';

export interface EconomicEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  currency: string;
  event: string;
  impact: ImpactLevel;
  previous: string;
  forecast: string;
  actual: string;
  surprise?: 'positive' | 'negative' | 'inline';
  description: string;
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  accountType: 'Simulated' | 'Real';
  quantity: number;
  avgEntryPrice: number;
  allocationTargetPct: number;
}

export interface PortfolioTransaction {
  id: string;
  timestamp: string;
  accountType: 'Simulated' | 'Real';
  symbol: string;
  side: 'Buy' | 'Sell' | 'Dividend' | 'Deposit';
  quantity: number;
  price: number;
  totalUsd: number;
  feeUsd: number;
  status: 'Settled' | 'Executed';
}

export interface ScreenerPreset {
  id: string;
  name: string;
  category: MarketCategory;
  minChangePct: string;
  maxChangePct: string;
  minRsi: string;
  maxRsi: string;
  maFilter: 'All' | 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  minPrice: string;
  maxPrice: string;
}

export interface UserSettingsState {
  fullName: string;
  email: string;
  roleTitle: string;
  timezone: string;
  baseCurrency: 'USD' | 'EUR' | 'GBP' | 'JPY';
  defaultTimeframe: Timeframe;
  confirmOrderTicket: boolean;
  liveTickSimulation: boolean;
  twoFactorEnabled: boolean;
  sessionTimeoutMins: number;
  notifyInApp: boolean;
  notifyEmail: boolean;
  notifySound: boolean;
  notifyEconomicHigh: boolean;
  language: 'English (US)' | 'English (UK)' | 'Deutsch' | 'Français' | '日本語';
  connectedAccounts: {
    id: string;
    provider: string;
    accountLabel: string;
    status: 'Connected' | 'Disconnected';
    lastSync: string;
  }[];
}

export type OrderSide = 'Buy' | 'Sell';
export type OrderType = 'Market' | 'Limit' | 'Stop';

export interface OpenPosition {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  leverage: number;
  openedAt: string;
  note?: string;
}

export interface WorkingOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: Exclude<OrderType, 'Market'>;
  quantity: number;
  limitOrStopPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
  status: 'Working' | 'Cancelled';
}

export interface TradeExecution {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  fillPrice: number;
  realizedPnl?: number;
  feeUsd: number;
  executedAt: string;
  status: 'Filled' | 'Closed';
}

export type AuthView = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

export type AdminUserRole = 'Admin' | 'Risk Officer' | 'Senior Analyst' | 'Trader';
export type AdminUserStatus = 'Active' | 'Suspended' | 'Pending KYC';

export interface AdminUserAccount {
  id: string;
  fullName: string;
  email: string;
  role: AdminUserRole;
  tier: 'Institutional' | 'Pro' | 'Standard';
  equityUsd: number;
  maxLeverage: number;
  twoFactorEnabled: boolean;
  status: AdminUserStatus;
  lastActive: string;
}

export interface AdminRiskConfig {
  maxFxLeverage: number;
  maxCryptoLeverage: number;
  maxEquityLeverage: number;
  marginCallPct: number;
  stopOutPct: number;
  commissionBps: number;
  orderRoutingEnabled: boolean;
  maintenanceBanner: boolean;
}

export interface AdminAuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  category: 'Access' | 'Risk' | 'Feed' | 'System';
  details: string;
}

