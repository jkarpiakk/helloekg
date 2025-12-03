import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Move, ArrowRight, Target, Upload } from "lucide-react";
import type { 
  DragDropConfig, 
  FillBlankConfig, 
  MatchingConfig, 
  SortingConfig, 
  HotspotConfig
} from "@shared/schema";
import type { QuestionType } from "@/types";

interface DragDropEditorProps {
  config: DragDropConfig;
  onChange: (config: DragDropConfig) => void;
}

export function DragDropEditor({ config, onChange }: DragDropEditorProps) {
  const addSource = () => {
    const newId = `source_${Date.now()}`;
    onChange({
      ...config,
      sources: [...config.sources, { id: newId, content: "", label: "" }],
    });
  };

  const addTarget = () => {
    const newId = `target_${Date.now()}`;
    onChange({
      ...config,
      targets: [...config.targets, { id: newId, label: "", acceptsSourceId: "" }],
    });
  };

  const updateSource = (index: number, field: string, value: string) => {
    const newSources = [...config.sources];
    newSources[index] = { ...newSources[index], [field]: value };
    onChange({ ...config, sources: newSources });
  };

  const updateTarget = (index: number, field: string, value: string) => {
    const newTargets = [...config.targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    onChange({ ...config, targets: newTargets });
  };

  const removeSource = (index: number) => {
    onChange({
      ...config,
      sources: config.sources.filter((_: any, i: number) => i !== index),
    });
  };

  const removeTarget = (index: number) => {
    onChange({
      ...config,
      targets: config.targets.filter((_: any, i: number) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-semibold">Strefy docelowe</Label>
          <Button type="button" variant="outline" size="sm" onClick={addTarget}>
            <Plus className="h-3 w-3 mr-1" /> Dodaj strefę
          </Button>
        </div>
        <div className="space-y-2">
          {config.targets.map((target: any, index: number) => (
            <div key={target.id} className="flex items-center space-x-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <Input
                value={target.label}
                onChange={(e) => updateTarget(index, "label", e.target.value)}
                placeholder={`Strefa ${index + 1} (np. "Arytmia")`}
                className="flex-1"
                data-testid={`input-target-${index}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeTarget(index)}
                disabled={config.targets.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-semibold">Elementy do przeciągnięcia</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSource}>
            <Plus className="h-3 w-3 mr-1" /> Dodaj element
          </Button>
        </div>
        <div className="space-y-2">
          {config.sources.map((source: any, index: number) => (
            <div key={source.id} className="flex items-center space-x-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <Input
                value={source.content}
                onChange={(e) => updateSource(index, "content", e.target.value)}
                placeholder={`Zawartość ${index + 1}`}
                className="flex-1"
                data-testid={`input-source-content-${index}`}
              />
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <select
                value={config.targets.find((t: any) => t.acceptsSourceId === source.id)?.id || ""}
                onChange={(e) => {
                  const targetIndex = config.targets.findIndex((t: any) => t.id === e.target.value);
                  if (targetIndex >= 0) {
                    updateTarget(targetIndex, "acceptsSourceId", source.id);
                  }
                }}
                className="h-10 px-3 rounded-md border border-input bg-background"
                data-testid={`select-source-target-${index}`}
              >
                <option value="">Wybierz strefę</option>
                {config.targets.map((target: any) => (
                  <option key={target.id} value={target.id}>
                    {target.label || target.id}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSource(index)}
                disabled={config.sources.length <= 1}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface FillBlankEditorProps {
  config: FillBlankConfig;
  onChange: (config: FillBlankConfig) => void;
}

export function FillBlankEditor({ config, onChange }: FillBlankEditorProps) {
  const addBlank = () => {
    const newId = `blank_${Date.now()}`;
    const newPosition = config.blanks.length;
    onChange({
      ...config,
      blanks: [...config.blanks, { 
        id: newId, 
        correctAnswers: [""], 
        validationType: "exact" as const,
        position: newPosition,
        placeholder: `Luka ${newPosition + 1}`
      }],
    });
  };

  const updateBlank = (index: number, field: string, value: any) => {
    const newBlanks = [...config.blanks];
    newBlanks[index] = { ...newBlanks[index], [field]: value };
    onChange({ ...config, blanks: newBlanks });
  };

  const addCorrectAnswer = (blankIndex: number) => {
    const newBlanks = [...config.blanks];
    newBlanks[blankIndex].correctAnswers.push("");
    onChange({ ...config, blanks: newBlanks });
  };

  const updateCorrectAnswer = (blankIndex: number, answerIndex: number, value: string) => {
    const newBlanks = [...config.blanks];
    newBlanks[blankIndex].correctAnswers[answerIndex] = value;
    onChange({ ...config, blanks: newBlanks });
  };

  const removeCorrectAnswer = (blankIndex: number, answerIndex: number) => {
    const newBlanks = [...config.blanks];
    newBlanks[blankIndex].correctAnswers = newBlanks[blankIndex].correctAnswers.filter(
      (_: any, i: number) => i !== answerIndex
    );
    onChange({ ...config, blanks: newBlanks });
  };

  const removeBlank = (index: number) => {
    onChange({
      ...config,
      blanks: config.blanks.filter((_: any, i: number) => i !== index),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Tekst z lukami (template)</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Użyj znaczników {"{{blank:ID}}"} w tekście pytania, aby oznaczyć miejsca na luki.
        </p>
        <Input
          value={config.template}
          onChange={(e) => onChange({ ...config, template: e.target.value })}
          placeholder="Np. Załamek {{blank:blank_1}} odpowiada za depolaryzację {{blank:blank_2}}."
          data-testid="input-template"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <Label className="text-base font-semibold">Definicje luk</Label>
          <Button type="button" variant="outline" size="sm" onClick={addBlank}>
            <Plus className="h-3 w-3 mr-1" /> Dodaj lukę
          </Button>
        </div>
        <div className="space-y-4">
          {config.blanks.map((blank: any, blankIndex: number) => (
            <Card key={blank.id}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{"{{blank:" + blank.id + "}}"}</Badge>
                  <div className="flex items-center space-x-2">
                    <select
                      value={blank.validationType}
                      onChange={(e) => updateBlank(blankIndex, "validationType", e.target.value)}
                      className="h-8 px-2 text-sm rounded-md border border-input bg-background"
                    >
                      <option value="exact">Dokładne dopasowanie</option>
                      <option value="regex">Wyrażenie regularne</option>
                      <option value="numeric_range">Zakres numeryczny</option>
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBlank(blankIndex)}
                      disabled={config.blanks.length <= 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-sm">Placeholder</Label>
                    <Input
                      value={blank.placeholder || ""}
                      onChange={(e) => updateBlank(blankIndex, "placeholder", e.target.value)}
                      placeholder="Tekst w pustej luce"
                      className="mt-1"
                      data-testid={`input-blank-placeholder-${blankIndex}`}
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Podpowiedź</Label>
                    <Input
                      value={blank.hint || ""}
                      onChange={(e) => updateBlank(blankIndex, "hint", e.target.value)}
                      placeholder="Opcjonalna podpowiedź"
                      className="mt-1"
                      data-testid={`input-blank-hint-${blankIndex}`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm">Poprawne odpowiedzi</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addCorrectAnswer(blankIndex)}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Alternatywa
                    </Button>
                  </div>
                  {blank.correctAnswers.map((answer: string, answerIndex: number) => (
                    <div key={answerIndex} className="flex items-center space-x-2 mt-1">
                      <Input
                        value={answer}
                        onChange={(e) => updateCorrectAnswer(blankIndex, answerIndex, e.target.value)}
                        placeholder="Poprawna odpowiedź"
                        data-testid={`input-blank-answer-${blankIndex}-${answerIndex}`}
                      />
                      {blank.correctAnswers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCorrectAnswer(blankIndex, answerIndex)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

interface MatchingEditorProps {
  config: MatchingConfig;
  onChange: (config: MatchingConfig) => void;
}

export function MatchingEditor({ config, onChange }: MatchingEditorProps) {
  const addPair = () => {
    const leftId = `left_${Date.now()}`;
    const rightId = `right_${Date.now()}`;
    onChange({
      ...config,
      leftColumn: [...config.leftColumn, { id: leftId, text: "" }],
      rightColumn: [...config.rightColumn, { id: rightId, text: "" }],
      correctPairs: [...config.correctPairs, { leftId, rightId }],
    });
  };

  const updateLeft = (index: number, text: string) => {
    const newLeft = [...config.leftColumn];
    newLeft[index] = { ...newLeft[index], text };
    onChange({ ...config, leftColumn: newLeft });
  };

  const updateRight = (index: number, text: string) => {
    const newRight = [...config.rightColumn];
    newRight[index] = { ...newRight[index], text };
    onChange({ ...config, rightColumn: newRight });
  };

  const removePair = (index: number) => {
    const leftId = config.leftColumn[index].id;
    onChange({
      ...config,
      leftColumn: config.leftColumn.filter((_: any, i: number) => i !== index),
      rightColumn: config.rightColumn.filter((_: any, i: number) => i !== index),
      correctPairs: config.correctPairs.filter((p: any) => p.leftId !== leftId),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Pary do dopasowania</Label>
          <p className="text-sm text-muted-foreground">
            Zdefiniuj elementy do połączenia w pary. Prawa kolumna będzie pomieszana podczas quizu.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPair}>
          <Plus className="h-3 w-3 mr-1" /> Dodaj parę
        </Button>
      </div>

      <div className="flex items-center space-x-2 mb-2">
        <label className="flex items-center space-x-2 text-sm">
          <input
            type="checkbox"
            checked={config.shuffleRight}
            onChange={(e) => onChange({ ...config, shuffleRight: e.target.checked })}
          />
          <span>Mieszaj prawą kolumnę</span>
        </label>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm font-medium text-muted-foreground">
          <div>Lewa strona</div>
          <div>Prawa strona (poprawna)</div>
        </div>
        {config.leftColumn.map((left: any, index: number) => (
          <div key={left.id} className="flex items-center space-x-2">
            <Input
              value={left.text}
              onChange={(e) => updateLeft(index, e.target.value)}
              placeholder={`Element ${index + 1}`}
              className="flex-1"
              data-testid={`input-left-${index}`}
            />
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              value={config.rightColumn[index]?.text || ""}
              onChange={(e) => updateRight(index, e.target.value)}
              placeholder={`Dopasowanie ${index + 1}`}
              className="flex-1"
              data-testid={`input-right-${index}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removePair(index)}
              disabled={config.leftColumn.length <= 2}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface SortingEditorProps {
  config: SortingConfig;
  onChange: (config: SortingConfig) => void;
}

export function SortingEditor({ config, onChange }: SortingEditorProps) {
  const addItem = () => {
    const newId = `item_${Date.now()}`;
    onChange({
      ...config,
      items: [...config.items, { id: newId, text: "" }],
      correctOrder: [...config.correctOrder, newId],
    });
  };

  const updateItem = (index: number, text: string) => {
    const newItems = [...config.items];
    newItems[index] = { ...newItems[index], text };
    onChange({ ...config, items: newItems });
  };

  const removeItem = (index: number) => {
    const itemId = config.items[index].id;
    onChange({
      ...config,
      items: config.items.filter((_: any, i: number) => i !== index),
      correctOrder: config.correctOrder.filter((id: string) => id !== itemId),
    });
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= config.items.length) return;
    
    const newItems = [...config.items];
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    
    const newOrder = newItems.map((item: any) => item.id);
    
    onChange({ ...config, items: newItems, correctOrder: newOrder });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Elementy do uporządkowania</Label>
          <p className="text-sm text-muted-foreground">
            Kolejność poniżej to poprawna kolejność. Użyj strzałek aby zmienić pozycję.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-3 w-3 mr-1" /> Dodaj element
        </Button>
      </div>

      <div className="space-y-2">
        {config.items.map((item: any, index: number) => (
          <div key={item.id} className="flex items-center space-x-2">
            <Badge variant="outline" className="w-8 justify-center">
              {index + 1}
            </Badge>
            <Input
              value={item.text}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={`Krok ${index + 1}`}
              className="flex-1"
              data-testid={`input-sort-item-${index}`}
            />
            <div className="flex space-x-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => moveItem(index, "up")}
                disabled={index === 0}
              >
                <Move className="h-4 w-4 rotate-180" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => moveItem(index, "down")}
                disabled={index === config.items.length - 1}
              >
                <Move className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeItem(index)}
              disabled={config.items.length <= 2}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HotspotEditorProps {
  config: HotspotConfig;
  onChange: (config: HotspotConfig) => void;
  onImageUpload: (file: File) => Promise<string>;
  isUploading?: boolean;
}

export function HotspotEditor({ config, onChange, onImageUpload, isUploading }: HotspotEditorProps) {
  const [clickMode, setClickMode] = useState(false);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!clickMode) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    const newHotspot = {
      id: `hotspot_${Date.now()}`,
      label: `Punkt ${config.hotspots.length + 1}`,
      shape: "circle" as const,
      coords: [Math.round(x * 10) / 10, Math.round(y * 10) / 10, 5],
      isCorrect: config.hotspots.length === 0,
    };
    
    onChange({
      ...config,
      hotspots: [...config.hotspots, newHotspot],
    });
    
    setClickMode(false);
  };

  const updateHotspot = (index: number, field: string, value: any) => {
    const newHotspots = [...config.hotspots];
    newHotspots[index] = { ...newHotspots[index], [field]: value };
    
    if (field === "isCorrect" && value === true && !config.allowMultiple) {
      newHotspots.forEach((h: any, i: number) => {
        if (i !== index) h.isCorrect = false;
      });
    }
    
    onChange({ ...config, hotspots: newHotspots });
  };

  const updateHotspotRadius = (index: number, radius: number) => {
    const newHotspots = [...config.hotspots];
    const coords = [...newHotspots[index].coords];
    coords[2] = radius;
    newHotspots[index] = { ...newHotspots[index], coords };
    onChange({ ...config, hotspots: newHotspots });
  };

  const removeHotspot = (index: number) => {
    onChange({
      ...config,
      hotspots: config.hotspots.filter((_: any, i: number) => i !== index),
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = await onImageUpload(file);
      onChange({ ...config, imageUrl: url });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Obraz z punktami klikalnymi</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Prześlij obraz EKG i kliknij na nim, aby dodać punkty klikalne.
        </p>
        
        <div className="flex items-center space-x-2 mb-2">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={config.allowMultiple}
              onChange={(e) => onChange({ ...config, allowMultiple: e.target.checked })}
            />
            <span>Pozwól na wiele odpowiedzi</span>
          </label>
        </div>
        
        {config.imageUrl ? (
          <div className="relative border rounded-lg overflow-hidden">
            <div className="relative">
              <img
                src={config.imageUrl}
                alt="Hotspot image"
                className={`w-full h-auto ${clickMode ? 'cursor-crosshair' : ''}`}
                onClick={handleImageClick}
                data-testid="img-hotspot-canvas"
              />
              {config.hotspots.map((hotspot: any, index: number) => (
                <div
                  key={hotspot.id}
                  className={`absolute w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transform -translate-x-1/2 -translate-y-1/2 ${
                    hotspot.isCorrect 
                      ? 'bg-green-500/80 border-green-600 text-white' 
                      : 'bg-red-500/80 border-red-600 text-white'
                  }`}
                  style={{
                    left: `${hotspot.coords[0]}%`,
                    top: `${hotspot.coords[1]}%`,
                  }}
                >
                  {index + 1}
                </div>
              ))}
            </div>
            <div className="absolute top-2 right-2 flex space-x-2">
              <Button
                type="button"
                variant={clickMode ? "default" : "secondary"}
                size="sm"
                onClick={() => setClickMode(!clickMode)}
              >
                <Target className="h-4 w-4 mr-1" />
                {clickMode ? "Klikam..." : "Dodaj punkt"}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onChange({ ...config, imageUrl: "" })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <input
              type="file"
              id="hotspotImage"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-hotspot-image"
            />
            <label
              htmlFor="hotspotImage"
              className="cursor-pointer flex flex-col items-center"
            >
              {isUploading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2" />
              ) : (
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
              )}
              <span className="text-sm text-muted-foreground">
                {isUploading ? "Przesyłanie..." : "Kliknij aby przesłać obraz EKG"}
              </span>
            </label>
          </div>
        )}
      </div>

      {config.hotspots.length > 0 && (
        <div>
          <Label className="text-base font-semibold mb-3 block">Zdefiniowane punkty</Label>
          <div className="space-y-2">
            {config.hotspots.map((hotspot: any, index: number) => (
              <div key={hotspot.id} className="flex items-center space-x-2 p-2 bg-muted rounded-lg">
                <Badge variant={hotspot.isCorrect ? "default" : "secondary"}>
                  {index + 1}
                </Badge>
                <Input
                  value={hotspot.label || ""}
                  onChange={(e) => updateHotspot(index, "label", e.target.value)}
                  placeholder="Opis punktu"
                  className="flex-1"
                  data-testid={`input-hotspot-label-${index}`}
                />
                <label className="flex items-center space-x-1 text-sm">
                  <input
                    type={config.allowMultiple ? "checkbox" : "radio"}
                    name="correctHotspot"
                    checked={hotspot.isCorrect}
                    onChange={() => updateHotspot(index, "isCorrect", !hotspot.isCorrect)}
                  />
                  <span>Poprawny</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={hotspot.coords[2] || 5}
                  onChange={(e) => updateHotspotRadius(index, parseInt(e.target.value) || 5)}
                  className="w-16"
                  placeholder="Promień"
                  data-testid={`input-hotspot-radius-${index}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHotspot(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Wybór wielokrotny (ABCD)",
  drag_drop: "Przeciągnij i upuść",
  fill_blank: "Uzupełnij luki",
  matching: "Połącz w pary",
  sorting: "Uporządkuj",
  hotspot: "Kliknij na obrazie",
};

export const QUESTION_TYPE_DESCRIPTIONS: Record<QuestionType, string> = {
  multiple_choice: "Klasyczne pytanie z 4 opcjami odpowiedzi",
  drag_drop: "Przeciągnij elementy do odpowiednich stref",
  fill_blank: "Uzupełnij brakujące słowa w tekście",
  matching: "Połącz elementy z lewej strony z odpowiednikami z prawej",
  sorting: "Ułóż elementy w poprawnej kolejności",
  hotspot: "Kliknij na wskazany obszar obrazu",
};

export function getDefaultConfig(type: QuestionType): DragDropConfig | FillBlankConfig | MatchingConfig | SortingConfig | HotspotConfig | null {
  switch (type) {
    case "drag_drop":
      return {
        sources: [{ id: "source_1", content: "", label: "" }],
        targets: [{ id: "target_1", label: "", acceptsSourceId: "source_1" }],
      };
    case "fill_blank":
      return {
        template: "",
        blanks: [{
          id: "blank_1",
          correctAnswers: [""],
          validationType: "exact",
          position: 0,
          placeholder: "Luka 1",
        }],
      };
    case "matching":
      return {
        leftColumn: [
          { id: "left_1", text: "" },
          { id: "left_2", text: "" },
        ],
        rightColumn: [
          { id: "right_1", text: "" },
          { id: "right_2", text: "" },
        ],
        correctPairs: [
          { leftId: "left_1", rightId: "right_1" },
          { leftId: "left_2", rightId: "right_2" },
        ],
        shuffleRight: true,
      };
    case "sorting":
      return {
        items: [
          { id: "item_1", text: "" },
          { id: "item_2", text: "" },
        ],
        correctOrder: ["item_1", "item_2"],
      };
    case "hotspot":
      return {
        imageUrl: "",
        hotspots: [],
        allowMultiple: false,
      };
    default:
      return null;
  }
}
