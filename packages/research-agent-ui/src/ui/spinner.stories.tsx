import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import Spinner, { SPINNER_VARIANTS } from './spinner';

/**
 * `Spinner` is the shadcn/ui-style loading component from the GRAB-URL
 * loading-animations set. It draws in `currentColor`, so a `text-*` class
 * restyles it, and sizes off a single `size` prop.
 */
const meta: Meta<typeof Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  args: { size: 48 },
  argTypes: {
    variant: { control: 'select', options: [...SPINNER_VARIANTS] },
  },
};

export default meta;
type Story = StoryObj<typeof Spinner>;

/** The rotating spokes, drawn at the default size. */
export const Default: Story = { args: { size: 24 } };

/** All eight variants side by side. */
export const AllVariants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-6 text-muted-foreground">
      {SPINNER_VARIANTS.map((variant) => (
        <figure key={variant} className="flex flex-col items-center gap-2 w-28">
          <Spinner {...args} variant={variant} />
          <figcaption className="text-xs">{variant}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

/** Recolored by the surrounding text color. */
export const Colored: Story = {
  render: (args) => (
    <div className="flex items-center gap-6">
      <Spinner {...args} variant="circle" className="text-primary" />
      <Spinner {...args} variant="bars" className="text-blue-500" />
      <Spinner {...args} variant="ring" className="text-emerald-500" />
    </div>
  ),
};
