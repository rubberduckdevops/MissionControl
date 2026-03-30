import { useState, useEffect, useRef } from 'react'
import Layout from '../components/Layout'
import Container from '@cloudscape-design/components/container'
import Header from '@cloudscape-design/components/header'
import SpaceBetween from '@cloudscape-design/components/space-between'
import Button from '@cloudscape-design/components/button'
import Input from '@cloudscape-design/components/input'
import FormField from '@cloudscape-design/components/form-field'
import ColumnLayout from '@cloudscape-design/components/column-layout'
import Box from '@cloudscape-design/components/box'
import ProgressBar from '@cloudscape-design/components/progress-bar'
import Alert from '@cloudscape-design/components/alert'

type TimerState = 'idle' | 'running' | 'paused' | 'finished'

export default function CountdownPage() {
  const [hours, setHours] = useState('1')
  const [minutes, setMinutes] = useState('0')
  const [seconds, setSeconds] = useState('0')
  const [totalSeconds, setTotalSeconds] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [timerState, setTimerState] = useState<TimerState>('idle')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!)
            setTimerState('finished')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [timerState])

  const handleStart = () => {
    const total =
      (parseInt(hours) || 0) * 3600 +
      (parseInt(minutes) || 0) * 60 +
      (parseInt(seconds) || 0)
    if (total <= 0) return
    setTotalSeconds(total)
    setRemaining(total)
    setTimerState('running')
  }

  const handleResume = () => setTimerState('running')

  const handlePause = () => setTimerState('paused')

  const handleReset = () => {
    setTimerState('idle')
    setTotalSeconds(0)
    setRemaining(0)
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const previewSeconds =
    (parseInt(hours) || 0) * 3600 +
    (parseInt(minutes) || 0) * 60 +
    (parseInt(seconds) || 0)

  const displayTime = timerState === 'idle' ? formatTime(previewSeconds) : formatTime(remaining)
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0
  const isActive = timerState !== 'idle'

  return (
    <Layout>
      <SpaceBetween size="l">
        <Header variant="h1">Countdown Timer</Header>

        {timerState === 'finished' && (
          <Alert type="success" header="Time's up!">
            Your countdown has completed.
          </Alert>
        )}

        <Container header={<Header variant="h2">Timer</Header>}>
          <SpaceBetween size="xl">
            <Box textAlign="center">
              <Box
                fontSize="display-l"
                fontWeight="bold"
                color={timerState === 'finished' ? 'text-status-success' : 'text-label'}
              >
                {displayTime}
              </Box>
            </Box>

            {isActive && (
              <ProgressBar
                value={progress}
                label="Elapsed"
                description={`${Math.round(progress)}% complete`}
              />
            )}

            <ColumnLayout columns={3}>
              <FormField label="Hours">
                <Input
                  type="number"
                  value={hours}
                  onChange={e => setHours(e.detail.value)}
                  disabled={isActive}
                />
              </FormField>
              <FormField label="Minutes">
                <Input
                  type="number"
                  value={minutes}
                  onChange={e => setMinutes(e.detail.value)}
                  disabled={isActive}
                />
              </FormField>
              <FormField label="Seconds">
                <Input
                  type="number"
                  value={seconds}
                  onChange={e => setSeconds(e.detail.value)}
                  disabled={isActive}
                />
              </FormField>
            </ColumnLayout>

            <SpaceBetween size="s" direction="horizontal">
              {timerState === 'idle' && (
                <Button variant="primary" onClick={handleStart} disabled={previewSeconds <= 0}>
                  Start
                </Button>
              )}
              {timerState === 'running' && (
                <Button onClick={handlePause}>Pause</Button>
              )}
              {timerState === 'paused' && (
                <Button variant="primary" onClick={handleResume}>Resume</Button>
              )}
              {isActive && (
                <Button onClick={handleReset}>Reset</Button>
              )}
            </SpaceBetween>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </Layout>
  )
}
