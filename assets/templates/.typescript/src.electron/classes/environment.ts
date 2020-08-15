export interface Environment {
    name: string;
    description: string;
    production: boolean;
    html_src: string;
    background_color: string;
    resizable: boolean;
    frame: boolean;
    default_width: number;
    default_height: number;
    min_width: number;
    min_height: number;
}