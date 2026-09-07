export type Scene = {
  id: string;
  name: string;
  bgUrl: string;
  gridSize: number;
  gridColor: string;
  gridType: 'square' | 'hex';
  isActive: boolean;
  width?: number;
  height?: number;
  ambientPlaylistId?: string;
  description?: string;
  thumbnail?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SceneCreateData = {
  name: string;
  bgUrl?: string;
  gridSize?: number;
  gridColor?: string;
  gridType?: 'square' | 'hex';
  isActive?: boolean;
  width?: number;
  height?: number;
  ambientPlaylistId?: string;
  description?: string;
  thumbnail?: string;
};

export type SceneUpdateData = Partial<SceneCreateData>;

export type SceneAction = {
  action: 'view' | 'activate' | 'edit' | 'duplicate' | 'delete' | 'select';
  scene: Scene;
};