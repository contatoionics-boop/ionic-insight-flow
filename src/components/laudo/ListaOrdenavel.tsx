import { useId, type ReactNode } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui-bits";

export function ListaOrdenavel<T>({ itens, idDe, onMover, render, disabled = false }: {
  itens: T[];
  idDe: (item: T, indice: number) => string;
  onMover: (origem: number, destino: number) => void;
  render: (item: T, indice: number, alca: ReactNode) => ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const ids = itens.map(idDe);
  function finalizar({ active, over }: DragEndEvent) {
    if (disabled || !over || active.id === over.id) return;
    const origem = ids.indexOf(String(active.id));
    const destino = ids.indexOf(String(over.id));
    if (origem >= 0 && destino >= 0) onMover(origem, destino);
  }
  return (
    <DndContext id={id} sensors={sensores} collisionDetection={closestCenter} onDragEnd={finalizar}
      accessibility={{ screenReaderInstructions: { draggable: "Pressione espaço para mover o bloco, use as setas para reposicionar e espaço para confirmar. Escape cancela." }, announcements: {
        onDragStart: () => "Bloco selecionado para mover.",
        onDragOver: ({ over }) => over ? `Posição ${ids.indexOf(String(over.id)) + 1} de ${ids.length}.` : "Fora da lista.",
        onDragEnd: () => "Movimentação concluída.",
        onDragCancel: () => "Movimentação cancelada.",
      } }}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {itens.map((item, i) => <ItemOrdenavel key={idDe(item, i)} id={idDe(item, i)} disabled={disabled || itens.length < 2}>{(alca) => render(item, i, alca)}</ItemOrdenavel>)}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function ItemOrdenavel({ id, disabled, children }: { id: string; disabled: boolean; children: (alca: ReactNode) => ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "relative z-10 opacity-80 ring-2 ring-primary rounded-lg" : "relative"}>
    {children(<span className="inline-flex shrink-0"><Button ref={setActivatorNodeRef} type="button" variant="ghost" size="sm" className="touch-none cursor-grab active:cursor-grabbing" title="Arrastar para reposicionar" aria-label="Arrastar para reposicionar bloco" disabled={disabled} {...attributes} {...listeners}><GripVertical className="h-4 w-4" /></Button></span>)}
  </div>;
}