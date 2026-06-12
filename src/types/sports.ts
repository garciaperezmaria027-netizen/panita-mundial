export interface Team {
  id: number;
  name: string;
  logo: string;
  winner?: boolean;
}

export interface Venue {
  id: number | null;
  name: string;
  city: string;
}

export interface Fixture {
  id: number;
  referee: string | null;
  timezone: string;
  date: string;
  timestamp: number;
  periods: {
    first: number | null;
    second: number | null;
  };
  venue: Venue;
  status: {
    long: string;
    short: string;
    elapsed: number | null;
  };
}

export interface MatchGoals {
  home: number | null;
  away: number | null;
}

export interface MatchScore {
  halftime: MatchGoals;
  fulltime: MatchGoals;
  extratime: MatchGoals;
  penalty: MatchGoals;
}

export interface ScorerEntry {
  name: string;
  minute: number;
  extra?: number;
}

export interface Match {
  fixture: Fixture;
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string;
    season: number;
    round: string;
  };
  teams: {
    home: Team;
    away: Team;
  };
  goals: MatchGoals;
  score: MatchScore;
  // Goleadores del partido (sólo disponible con el proveedor gratuito del Mundial 2026)
  goalScorers?: {
    home: ScorerEntry[];
    away: ScorerEntry[];
  };
}

export interface StandingTeam {
  rank: number;
  team: {
    id: number;
    name: string;
    logo: string;
  };
  points: number;
  goalsDiff: number;
  group: string;
  form: string;
  status: string;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: {
      for: number;
      against: number;
    };
  };
}

export interface GroupStanding {
  groupName: string;
  standings: StandingTeam[];
}

export interface PlayerStatsSummary {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number;
    birth: {
      date: string | null;
      place: string | null;
      country: string | null;
    };
    nationality: string;
    height: string | null;
    weight: string | null;
    injured: boolean;
    photo: string;
  };
  statistics: Array<{
    team: {
      id: number;
      name: string;
      logo: string;
    };
    league: {
      id: number;
      name: string;
      country: string;
      logo: string;
      flag: string;
      season: number;
    };
    games: {
      appearances: number;
      lineups: number;
      minutes: number;
      number: number | null;
      position: string;
      rating: string | null;
      captain: boolean;
    };
    substitutes: {
      in: number;
      out: number;
      bench: number;
    };
    shots: {
      total: number | null;
      on: number | null;
    };
    goals: {
      total: number;
      conceded: number | null;
      assists: number | null;
      saves: number | null;
    };
    passes: {
      total: number | null;
      key: number | null;
      accuracy: number | null;
    };
    tackles: {
      total: number | null;
      blocks: number | null;
      interceptions: number | null;
    };
    duels: {
      total: number | null;
      won: number | null;
    };
    dribbles: {
      attempts: number | null;
      success: number | null;
      past: number | null;
    };
    fouls: {
      draw: number | null;
      committed: number | null;
    };
    cards: {
      yellow: number;
      yellowred: number;
      red: number;
    };
    penalty: {
      won: number | null;
      commited: number | null;
      scored: number;
      missed: number;
      saved: number | null;
    };
  }>;
}

export interface TopScorerRow {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  goals: number;
  matchesPlayed: number;
}

export interface TopAssistRow {
  player: {
    id: number;
    name: string;
    photo: string;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  assists: number;
  matchesPlayed: number;
}

export interface PlayerLineup {
  player: {
    id: number;
    name: string;
    number: number;
    pos: string;
    grid: string | null;
  };
}

export interface MatchLineups {
  team: {
    id: number;
    name: string;
    logo: string;
    colors: any;
  };
  coach: {
    id: number;
    name: string;
    photo: string;
  };
  formation: string;
  startXI: PlayerLineup[];
  substitutes: PlayerLineup[];
}

export interface MatchEvent {
  time: {
    elapsed: number;
    extra: number | null;
  };
  team: {
    id: number;
    name: string;
    logo: string;
  };
  player: {
    id: number;
    name: string;
  };
  assist: {
    id: number | null;
    name: string | null;
  };
  type: string; // Goal, Card, subst, Var
  detail: string; // e.g. Yellow Card, Normal Goal, Penalty, etc.
  comments: string | null;
}

export interface MatchDetails {
  match: Match;
  events: MatchEvent[];
  lineups: MatchLineups[];
}
