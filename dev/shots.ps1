# Dev-only: batch of UI screenshots
$enc = { param($o) [uri]::EscapeDataString(($o | ConvertTo-Json -Compress -Depth 6)) }
$jobs = @(
  @{ n = 'relations'; save = 'save06'; steps = @(@{ click = 'Relationships' }) },
  @{ n = 'eric'; save = 'save06'; steps = @(@{ click = 'Eric(a)' }) },
  @{ n = 'give'; save = 'orig'; steps = @(@{ click = 'Give items' }, @{ click = 'Key items' }, @{ type = @('input[type=search]', 'wig') }) },
  @{ n = 'give2'; save = 'orig'; steps = @(@{ click = 'Give items' }, @{ click = 'Key items' }, @{ type = @('input[type=search]', 'wig') }, @{ click = 'Add to save' }, @{ click = 'Review changes' }) },
  @{ n = 'inventory'; save = 'wig'; steps = @(@{ click = 'Inventory' }) },
  @{ n = 'toggles'; save = 'orig'; steps = @(@{ click = 'Quick toggles' }, @{ check = '.toggle input' }) },
  @{ n = 'mvars'; save = 'orig'; steps = @(@{ click = 'Manual mode' }, @{ type = @('input[type=search]', 'accept') }, @{ click = 'Where is it used' }) },
  @{ n = 'msw'; save = 'orig'; steps = @(@{ click = 'Manual mode' }, @{ click = 'Switches' }, @{ type = @('input[type=search]', 'enmaid') }, @{ click = 'Where is it used' }) },
  @{ n = 'backups'; save = 'orig'; steps = @(@{ click = 'Backups' }) }
)
foreach ($j in $jobs) {
  $q = "save=$($j.save)&steps=" + (& $enc $j.steps)
  & "$PSScriptRoot\shot.ps1" -Page ui.html -Query $q -Out ("s_" + $j.n + ".png")
}
