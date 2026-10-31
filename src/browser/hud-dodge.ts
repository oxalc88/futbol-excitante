export interface Point2 { x:number; y:number }
export interface RectLike { left:number; right:number; top:number; bottom:number }
export function dodgeHud(points:Point2[],rects:{radar?:RectLike|null;card?:RectLike|null},margin=24):{radar:boolean;card:boolean}{
  const collides=(rect?:RectLike|null)=>!!rect&&points.some(p=>p.x>=rect.left-margin&&p.x<=rect.right+margin&&p.y>=rect.top-margin&&p.y<=rect.bottom+margin);
  return{radar:collides(rects.radar),card:collides(rects.card)};
}
