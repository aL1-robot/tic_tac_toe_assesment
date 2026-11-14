export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      games: {
        Row: {
          id: string;
          x_player: string;
          o_player: string | null;
          board: string;
          turn: string;
          status: Database["public"]["Enums"]["game_status"];
          winner: string | null;
          winning_line: number[] | null;
          end_reason: string | null;
          created_at: string;
          updated_at: string;
          last_move_at: string;
        };
        Insert: {
          id?: string;
          x_player: string;
          o_player?: string | null;
          board?: string;
          turn?: string;
          status?: Database["public"]["Enums"]["game_status"];
          winner?: string | null;
          winning_line?: number[] | null;
          end_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          last_move_at?: string;
        };
        Update: {
          id?: string;
          x_player?: string;
          o_player?: string | null;
          board?: string;
          turn?: string;
          status?: Database["public"]["Enums"]["game_status"];
          winner?: string | null;
          winning_line?: number[] | null;
          end_reason?: string | null;
          created_at?: string;
          updated_at?: string;
          last_move_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_o_player_fkey";
            columns: ["o_player"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_x_player_fkey";
            columns: ["x_player"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_stats: {
        Row: {
          user_id: string;
          wins: number;
          losses: number;
          draws: number;
          points: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          wins?: number;
          losses?: number;
          draws?: number;
          points?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          wins?: number;
          losses?: number;
          draws?: number;
          points?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_stats_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: { id: string; username: string; created_at: string };
        Insert: { id: string; username: string; created_at?: string };
        Update: { id?: string; username?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: {
      leaderboard: {
        Row: {
          user_id: string;
          username: string;
          wins: number;
          draws: number;
          losses: number;
          points: number;
          rank: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      cancel_waiting_game: { Args: { p_game_id: string }; Returns: undefined };
      claim_timeout: {
        Args: { p_game_id: string };
        Returns: Database["public"]["Tables"]["games"]["Row"];
      };
      finish_game: {
        Args: {
          p_game_id: string;
          p_winner: string;
          p_reason: string;
          p_line: number[] | null;
        };
        Returns: Database["public"]["Tables"]["games"]["Row"];
      };
      find_or_create_game: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["games"]["Row"];
      };
      make_move: {
        Args: { p_cell: number; p_game_id: string };
        Returns: Database["public"]["Tables"]["games"]["Row"];
      };
      resign_game: {
        Args: { p_game_id: string };
        Returns: Database["public"]["Tables"]["games"]["Row"];
      };
      ttt_winning_line: { Args: { p_board: string }; Returns: number[] | null };
      username_available: { Args: { p_username: string }; Returns: boolean };
    };
    Enums: {
      game_status: "waiting" | "active" | "finished";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
