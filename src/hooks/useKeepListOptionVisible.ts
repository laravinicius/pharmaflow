import { useLayoutEffect, type RefObject } from 'react';

export function useKeepListOptionVisible(listRef: RefObject<HTMLDivElement | null>, index: number) {
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || index < 0) return;

    const option = list.querySelector<HTMLButtonElement>(`[data-idx="${index}"]`);
    if (!option) return;

    const { top, bottom } = option.getBoundingClientRect();
    const visibleTop = list.getBoundingClientRect().top + list.clientTop;
    const visibleBottom = visibleTop + list.clientHeight;

    if (top < visibleTop) {
      list.scrollTop += top - visibleTop;
    } else if (bottom > visibleBottom) {
      list.scrollTop += bottom - visibleBottom;
    }
  }, [listRef, index]);
}
