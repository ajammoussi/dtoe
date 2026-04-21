import type { CreateJobRequest } from '../types';

export const jobTemplates: Array<{
  name: string;
  description: string;
  template: CreateJobRequest;
}> = [
  {
    name: 'Financial Data Analysis Pipeline',
    description: 'Download and analyze VIX (Volatility Index) historical data with statistical calculations',
    template: {
      name: 'Financial Data Analysis Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Download VIX Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv" -o vix_data.csv && echo "Downloaded VIX data successfully"',
          },
          timeoutSeconds: 60,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Validate Data Structure',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "if (Test-Path vix_data.csv) { $lines = Get-Content vix_data.csv; Write-Host \"Total lines: $($lines.Count)\"; Write-Host \"Header: $($lines[0])\" } else { Write-Host \"File not found\"; exit 1 }"',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-2',
          name: 'Extract High Volatility Days',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_data.csv; $highVol = $data | Where-Object { [double]$_.VIX_Close -gt 30 }; Write-Host \"High volatility days: $($highVol.Count)\"; $highVol | Select-Object -First 5 | Format-Table"',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-3',
          name: 'Calculate Monthly Averages',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_data.csv; $data | Select-Object @{N=\'Year\';E={$_.Date.Substring(0,4)}}, @{N=\'Month\';E={$_.Date.Substring(5,2)}}, @{N=\'VIX\';E={[double]$_.VIX_Close}} | Group-Object Year,Month | ForEach-Object { $avg = ($_.Group | Measure-Object VIX -Average).Average; Write-Host \"$($_.Name): $avg\" }"',
          },
          timeoutSeconds: 60,
          maxRetries: 2,
          dependsOn: ['task-2'],
        },
        {
          id: 'task-4',
          name: 'Generate Summary Report',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_data.csv; $vix = $data | ForEach-Object { [double]$_.VIX_Close }; $stats = $vix | Measure-Object -Minimum -Maximum -Average; Write-Host \"VIX Statistics:\"; Write-Host \"  Min: $($stats.Minimum)\"; Write-Host \"  Max: $($stats.Maximum)\"; Write-Host \"  Avg: $($stats.Average)\"; Write-Host \"  Count: $($vix.Count)\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-3'],
        },
      ],
    },
  },
  {
    name: 'Economic Data Processing Pipeline',
    description: 'Process CPI (Consumer Price Index) data with inflation rate calculations',
    template: {
      name: 'Economic Data Processing Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Download CPI Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/cpi/master/data/cpi.csv" -o cpi_data.csv && echo "Downloaded CPI data successfully"',
          },
          timeoutSeconds: 60,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Filter Recent Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv cpi_data.csv; $recent = $data | Where-Object { $_.Year -ge 2020 }; Write-Host \"Recent records: $($recent.Count)\"; $recent | Select-Object -First 10 | Format-Table"',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-2',
          name: 'Calculate Yearly Averages',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv cpi_data.csv; $yearly = $data | Group-Object Year | ForEach-Object { $avg = ($_.Group | Measure-Object Value -Average).Average; Write-Host \"$($_.Name): $avg\" }"',
          },
          timeoutSeconds: 60,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-3',
          name: 'Identify High Inflation Periods',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv cpi_data.csv; $highInf = $data | Where-Object { [double]$_.Value -gt 200 }; Write-Host \"High inflation periods: $($highInf.Count)\"; $highInf | Select-Object -First 5 | Format-Table"',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-2'],
        },
        {
          id: 'task-4',
          name: 'Generate Inflation Report',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv cpi_data.csv; $values = $data | ForEach-Object { [double]$_.Value }; $stats = $values | Measure-Object -Minimum -Maximum -Average; Write-Host \"CPI Statistics:\"; Write-Host \"  Min: $($stats.Minimum)\"; Write-Host \"  Max: $($stats.Maximum)\"; Write-Host \"  Avg: $($stats.Average)\"; Write-Host \"  Records: $($values.Count)\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-3'],
        },
      ],
    },
  },
  {
    name: 'Data Validation & Cleaning Pipeline',
    description: 'Validate and clean financial datasets with quality checks',
    template: {
      name: 'Data Validation & Cleaning Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Download Datasets',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv" -o vix_raw.csv && curl -s "https://raw.githubusercontent.com/datasets/cpi/master/data/cpi.csv" -o cpi_raw.csv && echo "Downloaded both datasets"',
          },
          timeoutSeconds: 90,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Check for Missing Values',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$vix = Import-Csv vix_raw.csv; $cpi = Import-Csv cpi_raw.csv; $vixMissing = ($vix | Where-Object { $_.VIX_Close -eq \"\" -or $_.VIX_Close -eq $null }).Count; $cpiMissing = ($cpi | Where-Object { $_.Value -eq \"\" -or $_.Value -eq $null }).Count; Write-Host \"VIX missing: $vixMissing\"; Write-Host \"CPI missing: $cpiMissing\""',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-2',
          name: 'Validate Data Ranges',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$vix = Import-Csv vix_raw.csv; $cpi = Import-Csv cpi_raw.csv; $vixInvalid = ($vix | Where-Object { [double]$_.VIX_Close -lt 0 -or [double]$_.VIX_Close -gt 100 }).Count; $cpiInvalid = ($cpi | Where-Object { [double]$_.Value -lt 0 }).Count; Write-Host \"VIX invalid: $vixInvalid\"; Write-Host \"CPI invalid: $cpiInvalid\""',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-3',
          name: 'Remove Duplicates',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$vix = Import-Csv vix_raw.csv; $cpi = Import-Csv cpi_raw.csv; $vixUnique = $vix | Sort-Object Date -Unique; $cpiUnique = $cpi | Sort-Object Year,Period -Unique; Write-Host \"VIX unique: $($vixUnique.Count)\"; Write-Host \"CPI unique: $($cpiUnique.Count)\""',
          },
          timeoutSeconds: 60,
          maxRetries: 2,
          dependsOn: ['task-2'],
        },
        {
          id: 'task-4',
          name: 'Generate Quality Report',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "Write-Host \"Data Quality Report:\"; Write-Host \"  VIX records: $((Import-Csv vix_raw.csv).Count)\"; Write-Host \"  CPI records: $((Import-Csv cpi_raw.csv).Count)\"; Write-Host \"  Validation: PASSED\"; Write-Host \"  Cleaning: COMPLETED\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-3'],
        },
      ],
    },
  },
  {
    name: 'Statistical Analysis Pipeline',
    description: 'Calculate comprehensive statistics and generate analytical reports',
    template: {
      name: 'Statistical Analysis Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Load VIX Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv" -o vix_stats.csv && echo "Loaded VIX data for analysis"',
          },
          timeoutSeconds: 60,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Calculate Descriptive Statistics',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_stats.csv; $vix = $data | ForEach-Object { [double]$_.VIX_Close }; $stats = $vix | Measure-Object -Minimum -Maximum -Average -StandardDeviation; Write-Host \"Statistics:\"; Write-Host \"  Count: $($vix.Count)\"; Write-Host \"  Mean: $($stats.Average)\"; Write-Host \"  StdDev: $($stats.StandardDeviation)\"; Write-Host \"  Min: $($stats.Minimum)\"; Write-Host \"  Max: $($stats.Maximum)\""',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-2',
          name: 'Calculate Percentiles',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_stats.csv; $vix = ($data | ForEach-Object { [double]$_.VIX_Close }) | Sort-Object; $p25 = $vix[[math]::Floor($vix.Count * 0.25)]; $p50 = $vix[[math]::Floor($vix.Count * 0.50)]; $p75 = $vix[[math]::Floor($vix.Count * 0.75)]; Write-Host \"Percentiles:\"; Write-Host \"  25th: $p25\"; Write-Host \"  50th: $p50\"; Write-Host \"  75th: $p75\""',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-3',
          name: 'Analyze Volatility Trends',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_stats.csv; $data | Select-Object @{N=\'Year\';E={$_.Date.Substring(0,4)}}, @{N=\'VIX\';E={[double]$_.VIX_Close}} | Group-Object Year | ForEach-Object { $avg = ($_.Group | Measure-Object VIX -Average).Average; $max = ($_.Group | Measure-Object VIX -Maximum).Maximum; Write-Host \"$($_.Name): Avg=$avg, Max=$max\" }"',
          },
          timeoutSeconds: 60,
          maxRetries: 2,
          dependsOn: ['task-2'],
        },
        {
          id: 'task-4',
          name: 'Generate Final Report',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "Write-Host \"=== STATISTICAL ANALYSIS REPORT ===\"; Write-Host \"Dataset: VIX Daily\"; Write-Host \"Analysis Date: $(Get-Date -Format \'yyyy-MM-dd\')\"; Write-Host \"Status: COMPLETED\"; Write-Host \"==================================\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-3'],
        },
      ],
    },
  },
  {
    name: 'Data Transformation Pipeline',
    description: 'Transform and normalize financial data formats',
    template: {
      name: 'Data Transformation Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Download Source Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv" -o vix_source.csv && echo "Downloaded source data"',
          },
          timeoutSeconds: 60,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Parse and Extract Fields',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_source.csv; $extracted = $data | Select-Object Date, VIX_Open, VIX_High, VIX_Low, VIX_Close; Write-Host \"Extracted $($extracted.Count) records\"; $extracted | Select-Object -First 5 | Format-Table"',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-2',
          name: 'Normalize Values',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_source.csv; $normalized = $data | Select-Object Date, @{N=\'VIX_Open_Norm\';E={[math]::Round([double]$_.VIX_Open,2)}}, @{N=\'VIX_Close_Norm\';E={[math]::Round([double]$_.VIX_Close,2)}}; Write-Host \"Normalized $($normalized.Count) values\"; $normalized | Select-Object -First 5 | Format-Table"',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-3',
          name: 'Calculate Derived Metrics',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_source.csv; $derived = $data | Select-Object Date, @{N=\'Daily_Range\';E={[math]::Round([double]$_.VIX_High - [double]$_.VIX_Low,2)}}, @{N=\'Daily_Change\';E={[math]::Round([double]$_.VIX_Close - [double]$_.VIX_Open,2)}}; Write-Host \"Calculated derived metrics\"; $derived | Select-Object -First 5 | Format-Table"',
          },
          timeoutSeconds: 60,
          maxRetries: 2,
          dependsOn: ['task-2'],
        },
        {
          id: 'task-4',
          name: 'Export Transformed Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv vix_source.csv; $transformed = $data | Select-Object Date, @{N=\'Open\';E={[double]$_.VIX_Open}}, @{N=\'High\';E={[double]$_.VIX_High}}, @{N=\'Low\';E={[double]$_.VIX_Low}}, @{N=\'Close\';E={[double]$_.VIX_Close}}; $transformed | Export-Csv vix_transformed.csv -NoTypeInformation; Write-Host \"Exported transformed data to vix_transformed.csv\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-3'],
        },
      ],
    },
  },
  {
    name: 'Batch Processing Pipeline',
    description: 'Process multiple financial datasets in parallel',
    template: {
      name: 'Batch Processing Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Download VIX Dataset',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv" -o batch_vix.csv && echo "Downloaded VIX dataset"',
          },
          timeoutSeconds: 60,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Download CPI Dataset',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/cpi/master/data/cpi.csv" -o batch_cpi.csv && echo "Downloaded CPI dataset"',
          },
          timeoutSeconds: 60,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-2',
          name: 'Process VIX Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv batch_vix.csv; $vix = $data | ForEach-Object { [double]$_.VIX_Close }; $stats = $vix | Measure-Object -Average -Maximum -Minimum; Write-Host \"VIX Processing:\"; Write-Host \"  Records: $($vix.Count)\"; Write-Host \"  Avg: $($stats.Average)\"; Write-Host \"  Max: $($stats.Maximum)\""',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-3',
          name: 'Process CPI Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv batch_cpi.csv; $cpi = $data | ForEach-Object { [double]$_.Value }; $stats = $cpi | Measure-Object -Average -Maximum -Minimum; Write-Host \"CPI Processing:\"; Write-Host \"  Records: $($cpi.Count)\"; Write-Host \"  Avg: $($stats.Average)\"; Write-Host \"  Max: $($stats.Maximum)\""',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-4',
          name: 'Aggregate Results',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "Write-Host \"=== BATCH PROCESSING SUMMARY ===\"; Write-Host \"Datasets processed: 2\"; Write-Host \"VIX records: $((Import-Csv batch_vix.csv).Count)\"; Write-Host \"CPI records: $((Import-Csv batch_cpi.csv).Count)\"; Write-Host \"Status: ALL COMPLETED\"; Write-Host \"==============================\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-2', 'task-3'],
        },
      ],
    },
  },
  {
    name: 'Data Compression & Archival Pipeline',
    description: 'Compress and backup financial datasets',
    template: {
      name: 'Data Compression & Archival Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Download Datasets',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv" -o archive_vix.csv && curl -s "https://raw.githubusercontent.com/datasets/cpi/master/data/cpi.csv" -o archive_cpi.csv && echo "Downloaded datasets for archival"',
          },
          timeoutSeconds: 90,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Calculate File Sizes',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "if (Test-Path archive_vix.csv) { $size = (Get-Item archive_vix.csv).Length; Write-Host \"VIX file size: $size bytes\" } if (Test-Path archive_cpi.csv) { $size = (Get-Item archive_cpi.csv).Length; Write-Host \"CPI file size: $size bytes\" }"',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-2',
          name: 'Create Backup Directory',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "New-Item -ItemType Directory -Force -Path backup | Out-Null; Write-Host \"Created backup directory\""',
          },
          timeoutSeconds: 15,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-3',
          name: 'Copy Files to Backup',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "Copy-Item archive_vix.csv backup\\vix_backup.csv; Copy-Item archive_cpi.csv backup\\cpi_backup.csv; Write-Host \"Copied files to backup directory\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-2'],
        },
        {
          id: 'task-4',
          name: 'Generate Archive Report',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "Write-Host \"=== ARCHIVAL REPORT ===\"; Write-Host \"Date: $(Get-Date -Format \'yyyy-MM-dd HH:mm:ss\')\"; Write-Host \"Files archived: 2\"; Write-Host \"Location: ./backup/\"; Write-Host \"Status: COMPLETED\"; Write-Host \"====================\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-3'],
        },
      ],
    },
  },
  {
    name: 'Real-time Data Monitoring Pipeline',
    description: 'Monitor data changes and generate alerts',
    template: {
      name: 'Real-time Data Monitoring Pipeline',
      submittedBy: 'demo-user',
      tasks: [
        {
          id: 'task-0',
          name: 'Fetch Current VIX Data',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'curl -s "https://raw.githubusercontent.com/datasets/finance-vix/master/data/vix-daily.csv" -o monitor_vix.csv && echo "Fetched current VIX data"',
          },
          timeoutSeconds: 60,
          maxRetries: 3,
          dependsOn: [],
        },
        {
          id: 'task-1',
          name: 'Analyze Latest Values',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv monitor_vix.csv; $latest = $data | Select-Object -Last 5; Write-Host \"Latest 5 VIX values:\"; $latest | ForEach-Object { Write-Host \"  $($_.Date): $($_.VIX_Close)\" }"',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-0'],
        },
        {
          id: 'task-2',
          name: 'Check for Anomalies',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv monitor_vix.csv; $vix = $data | ForEach-Object { [double]$_.VIX_Close }; $avg = ($vix | Measure-Object -Average).Average; $threshold = $avg * 1.5; $anomalies = $data | Where-Object { [double]$_.VIX_Close -gt $threshold }; Write-Host \"Threshold: $threshold\"; Write-Host \"Anomalies found: $($anomalies.Count)\""',
          },
          timeoutSeconds: 45,
          maxRetries: 2,
          dependsOn: ['task-1'],
        },
        {
          id: 'task-3',
          name: 'Generate Alert Summary',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "$data = Import-Csv monitor_vix.csv; $recent = $data | Where-Object { $_.Date -ge \"2023-01-01\" }; Write-Host \"Recent records: $($recent.Count)\"; Write-Host \"Monitoring period: 2023-present\"; Write-Host \"Alert status: NORMAL\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-2'],
        },
        {
          id: 'task-4',
          name: 'Create Monitoring Report',
          type: 'SHELL_COMMAND',
          payload: {
            command: 'powershell -Command "Write-Host \"=== MONITORING REPORT ===\"; Write-Host \"Timestamp: $(Get-Date -Format \'yyyy-MM-dd HH:mm:ss\")\"; Write-Host \"Dataset: VIX Daily\"; Write-Host \"Status: ACTIVE\"; Write-Host \"Alerts: 0\"; Write-Host \"========================\""',
          },
          timeoutSeconds: 30,
          maxRetries: 2,
          dependsOn: ['task-3'],
        },
      ],
    },
  },
];
